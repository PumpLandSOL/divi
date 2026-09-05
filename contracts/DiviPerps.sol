// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DiviPerps — perpetuals on tokenized stocks that pay real dividends, 24/7, on Robinhood Chain
/// @notice USDG-collateralised long/short positions filled against a signed 24/7 fair value (mark ± conf/2).
///         The difference from every other perp: on an ex-dividend date the dividend actually moves.
///         Shorts pay it, longs receive it, pro rata by shares (size / entry) — exactly like a stock loan.
///         Longs are made whole for the ex-date gap; shorts owe what a real short owes. Nothing is minted,
///         nothing is subsidised: the LP pool only carries its own net exposure, which the price gap offsets.
///         Dividends are settled permissionlessly against an oracle-signed (symbol, amount, exTs) record;
///         the caller earns a small bounty from the cash collected.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract DiviPerps {
    struct Px  { bytes32 sym; int64 price; uint64 conf; uint64 ts; uint8 session; bytes32 r; bytes32 s; }
    struct Div { bytes32 sym; int64 amount; uint64 exTs; bytes32 r; bytes32 s; }   // amount = USD per share · 1e8
    struct Pos { address owner; bytes32 sym; bool isLong; uint8 status; uint128 margin; uint128 size; int64 entry; uint64 openedAt; int64 exit; }
    // status: 0 open · 1 closed · 2 liquidated

    IERC20 public immutable USDG;
    address public signer;
    address public guardian;
    uint256 public maxLev = 10;
    uint16  public feeBps = 8;
    uint16  public maintBps = 500;
    uint16  public liqBountyBps = 2000;
    uint16  public settleBountyBps = 100;   // of dividend cash collected from shorts → the settler
    uint64  public maxAge = 90;
    uint64  public settleWindow = 45 days;  // a dividend can be settled from exTs until exTs + window
    uint256 public oiCap = 4;
    bool    public paused;

    mapping(address => uint256) public free;
    uint256 public poolBalance;
    uint256 public totalShares;
    mapping(address => uint256) public shares;
    uint256 public openInterest;
    Pos[] public positions;
    mapping(address => uint256[]) internal userPos;
    mapping(bytes32 => bool) public listed;
    mapping(uint256 => uint64) public lastDiv;              // position id → last exTs settled
    mapping(address => uint256) public dividendsReceived;   // lifetime USDG received as a long
    mapping(address => uint256) public dividendsPaid;       // lifetime USDG paid as a short
    uint256 public totalDividends;                          // lifetime USDG moved short → long

    event Deposit(address indexed u, uint256 amt);
    event Withdraw(address indexed u, uint256 amt);
    event Provide(address indexed u, uint256 amt, uint256 sh);
    event Redeem(address indexed u, uint256 amt, uint256 sh);
    event Open(uint256 indexed id, address indexed u, bytes32 sym, bool isLong, uint256 margin, uint256 size, int64 entry, uint8 session);
    event Close(uint256 indexed id, address indexed u, int64 exit, int256 pnl, uint256 payout);
    event Liquidate(uint256 indexed id, address indexed u, address liquidator, int64 exit, uint256 bounty);
    event Dividend(uint256 indexed id, address indexed u, bytes32 sym, uint64 exTs, bool isLong, uint256 cash);
    event DividendSettled(bytes32 indexed sym, uint64 exTs, uint256 fromShorts, uint256 toLongs, address settler, uint256 bounty);

    modifier onlyGuardian() { require(msg.sender == guardian, "guardian"); _; }

    constructor(address usdg, address _signer, bytes32[] memory syms) {
        USDG = IERC20(usdg); signer = _signer; guardian = msg.sender;
        for (uint256 i = 0; i < syms.length; i++) listed[syms[i]] = true;
    }

    // ── oracle ──────────────────────────────────────────────────────────────────
    function priceHash(Px calldata p) public pure returns (bytes32) { return sha256(abi.encodePacked("DIVIv1", p.sym, p.price, p.conf, p.ts, p.session)); }
    function divHash(Div calldata d) public pure returns (bytes32) { return sha256(abi.encodePacked("DIVIdiv1", d.sym, d.amount, d.exTs)); }
    function _sigOk(bytes32 h, bytes32 r, bytes32 s) internal view returns (bool) { return ecrecover(h, 27, r, s) == signer || ecrecover(h, 28, r, s) == signer; }
    function _verify(Px calldata p) internal view {
        require(listed[p.sym], "not listed");
        require(p.price > 0 && p.ts + maxAge >= block.timestamp && p.ts <= block.timestamp + 5, "stale price");
        require(_sigOk(priceHash(p), p.r, p.s), "bad sig");
    }
    function _fill(Px calldata p, bool buy) internal pure returns (int64) { int64 half = int64(p.conf / 2); return buy ? p.price + half : p.price - half; }

    // ── collateral ──────────────────────────────────────────────────────────────
    function deposit(uint256 amt) external { require(USDG.transferFrom(msg.sender, address(this), amt), "transfer"); free[msg.sender] += amt; emit Deposit(msg.sender, amt); }
    function withdraw(uint256 amt) external { require(free[msg.sender] >= amt, "free"); free[msg.sender] -= amt; require(USDG.transfer(msg.sender, amt), "transfer"); emit Withdraw(msg.sender, amt); }

    // ── LP pool ─────────────────────────────────────────────────────────────────
    function provide(uint256 amt) external {
        require(USDG.transferFrom(msg.sender, address(this), amt), "transfer");
        uint256 sh = totalShares == 0 || poolBalance == 0 ? amt : amt * totalShares / poolBalance;
        poolBalance += amt; totalShares += sh; shares[msg.sender] += sh;
        emit Provide(msg.sender, amt, sh);
    }
    function redeem(uint256 sh) external {
        require(shares[msg.sender] >= sh && sh > 0, "shares");
        uint256 amt = sh * poolBalance / totalShares;
        require(poolBalance - amt >= openInterest / oiCap, "pool backs open interest");
        shares[msg.sender] -= sh; totalShares -= sh; poolBalance -= amt;
        require(USDG.transfer(msg.sender, amt), "transfer");
        emit Redeem(msg.sender, amt, sh);
    }

    // ── trading ─────────────────────────────────────────────────────────────────
    function open(Px calldata p, bool isLong, uint256 margin, uint256 lev) external returns (uint256 id) {
        require(!paused, "paused");
        _verify(p);
        require(lev >= 1 && lev <= maxLev, "lev");
        require(free[msg.sender] >= margin && margin > 0, "margin");
        uint256 size = margin * lev;
        uint256 fee = size * feeBps / 10000;
        require(fee < margin, "fee");
        require(openInterest + size <= poolBalance * oiCap, "oi cap");
        free[msg.sender] -= margin; poolBalance += fee;
        int64 entry = _fill(p, isLong);
        id = positions.length;
        positions.push(Pos(msg.sender, p.sym, isLong, 0, uint128(margin - fee), uint128(size), entry, uint64(block.timestamp), 0));
        userPos[msg.sender].push(id);
        openInterest += size;
        emit Open(id, msg.sender, p.sym, isLong, margin - fee, size, entry, p.session);
    }
    function pnlOf(Pos memory q, int64 px) public pure returns (int256) {
        int256 d = int256(px) - int256(q.entry); if (!q.isLong) d = -d;
        return d * int256(uint256(q.size)) / int256(q.entry);
    }
    /// shares a position represents, 6 decimals: size (USDG·1e6) / entry (USD·1e8) · 1e8
    function sharesOf(Pos memory q) public pure returns (uint256) { return uint256(q.size) * 1e8 / uint256(uint64(q.entry)); }

    function close(uint256 id, Px calldata p) external {
        Pos storage q = positions[id];
        require(q.owner == msg.sender && q.status == 0 && q.sym == p.sym, "position");
        _verify(p);
        int64 exit = _fill(p, !q.isLong);
        int256 pnl = pnlOf(q, exit);
        uint256 fee = uint256(q.size) * feeBps / 10000;
        int256 net = int256(uint256(q.margin)) + pnl - int256(fee);
        uint256 payout = net > 0 ? uint256(net) : 0;
        if (payout > uint256(q.margin) + poolBalance) payout = uint256(q.margin) + poolBalance;
        if (payout >= q.margin) poolBalance -= (payout - q.margin); else poolBalance += (q.margin - payout);
        free[msg.sender] += payout;
        q.status = 1; q.exit = exit; openInterest -= q.size;
        emit Close(id, msg.sender, exit, pnl, payout);
    }
    function liquidatable(uint256 id, int64 px) public view returns (bool) {
        Pos memory q = positions[id];
        if (q.status != 0) return false;
        int256 eq = int256(uint256(q.margin)) + pnlOf(q, px);
        return eq <= int256(uint256(q.size) * maintBps / 10000);
    }
    function liquidate(uint256 id, Px calldata p) external {
        Pos storage q = positions[id];
        require(q.status == 0 && q.sym == p.sym, "position");
        _verify(p);
        require(liquidatable(id, p.price), "healthy");
        int256 eq = int256(uint256(q.margin)) + pnlOf(q, p.price);
        uint256 remain = eq > 0 ? uint256(eq) : 0;
        uint256 bounty = remain * liqBountyBps / 10000;
        poolBalance += q.margin - bounty;
        free[msg.sender] += bounty;
        q.status = 2; q.exit = p.price; openInterest -= q.size;
        emit Liquidate(id, q.owner, msg.sender, p.price, bounty);
    }

    // ── dividends ───────────────────────────────────────────────────────────────
    /// @notice Settle one dividend record over positions [from, to). Permissionless; call again for the next page.
    ///         Shorts opened before exTs pay shares × amount from margin (a short that cannot cover is closed
    ///         out to the pool). Longs opened before exTs receive shares × amount as free cash. The settler
    ///         earns settleBountyBps of what was collected from shorts.
    function settleDividend(Div calldata d, uint256 from, uint256 to) external {
        require(listed[d.sym] && d.amount > 0, "record");
        require(block.timestamp >= d.exTs && block.timestamp <= d.exTs + settleWindow, "window");
        require(_sigOk(divHash(d), d.r, d.s), "bad sig");
        if (to > positions.length) to = positions.length;
        uint256 fromShorts; uint256 toLongs;
        for (uint256 i = from; i < to; i++) {
            Pos storage q = positions[i];
            if (q.status != 0 || q.sym != d.sym || q.openedAt >= d.exTs || lastDiv[i] >= d.exTs) continue;
            lastDiv[i] = d.exTs;
            uint256 cash = sharesOf(q) * uint256(uint64(d.amount)) / 1e8;
            if (cash == 0) continue;
            if (q.isLong) {
                free[q.owner] += cash; dividendsReceived[q.owner] += cash; toLongs += cash;
            } else {
                if (cash >= q.margin) { cash = q.margin; q.status = 2; q.exit = 0; openInterest -= q.size; }
                q.margin -= uint128(cash);
                dividendsPaid[q.owner] += cash; fromShorts += cash;
            }
            emit Dividend(i, q.owner, d.sym, d.exTs, q.isLong, cash);
        }
        uint256 bounty = fromShorts * settleBountyBps / 10000;
        // pool receives what shorts paid (minus the bounty) and funds what longs are owed; it must stay solvent
        require(poolBalance + fromShorts >= toLongs + bounty, "pool");
        poolBalance = poolBalance + fromShorts - bounty - toLongs;
        free[msg.sender] += bounty;
        totalDividends += toLongs;
        emit DividendSettled(d.sym, d.exTs, fromShorts, toLongs, msg.sender, bounty);
    }

    // ── views ───────────────────────────────────────────────────────────────────
    function count() external view returns (uint256) { return positions.length; }
    function idsOf(address u) external view returns (uint256[] memory) { return userPos[u]; }

    // ── guardian ────────────────────────────────────────────────────────────────
    function setSigner(address s) external onlyGuardian { signer = s; }
    function setListed(bytes32 sym, bool on) external onlyGuardian { listed[sym] = on; }
    function setParams(uint256 _maxLev, uint16 _feeBps, uint16 _maintBps, uint16 _liqBountyBps, uint16 _settleBountyBps, uint64 _maxAge, uint64 _settleWindow, uint256 _oiCap) external onlyGuardian {
        maxLev = _maxLev; feeBps = _feeBps; maintBps = _maintBps; liqBountyBps = _liqBountyBps; settleBountyBps = _settleBountyBps; maxAge = _maxAge; settleWindow = _settleWindow; oiCap = _oiCap;
    }
    function setPaused(bool p) external onlyGuardian { paused = p; }
    function setGuardian(address g) external onlyGuardian { guardian = g; }
}
