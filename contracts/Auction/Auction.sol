//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/INFT.sol";

contract Auction is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    IERC20 public token;

    mapping(uint256 => AuctionInfo) public auctions;

    uint256 constant DEFAULT_DURATION = 86400;
    uint256 private defaultTimeExtension;
    uint256 private bidIncrementPercentage; // 100 = 1,00% higher than the previous bid

    struct AuctionInfo {
        address highestBidder;
        INFT nftContract;
        uint32 startTime;
        uint32 endTime;
        bool settled;
        uint256 nftId;
        uint256 minimumPrice;
        uint256 highestBid;
        string nftUri;
    }

    event AuctionCreated(uint256 auctionId, uint256 nftId);

    event AuctionCancelled(uint256 auctionId);

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed highestBidder,
        uint256 highestBid
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmount,
        uint256 newEndTime
    );

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Admin calls only");
        _;
    }

    /**
     * @dev Constructor for an upgradable contract
     */
    function initialize(
        address _admin,
        uint256 _defaultTimeExtension,
        uint256 _bidIncrementPercentage,
        address _token
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        defaultTimeExtension = _defaultTimeExtension;
        bidIncrementPercentage = _bidIncrementPercentage;
        token = IERC20(_token);
    }

    function setDefaultTimeExtension(uint16 _timeExtension) public onlyAdmin {
        defaultTimeExtension = _timeExtension;
    }

    function setBidIncrementPercentage(uint16 _bidIncrementPercentage)
        public
        onlyAdmin
    {
        bidIncrementPercentage = _bidIncrementPercentage;
    }

    function setToken(address _token) public onlyAdmin {
        token = IERC20(_token);
    }

    function createAuction(
        uint256 _auctionId,
        uint256 _nftId,
        uint256 _minimumPrice,
        uint32 _startTime,
        uint32 _endTime,
        INFT _nftContract,
        string memory _nftUri
    ) public onlyAdmin returns (uint256 auctionId) {
        require(_endTime == 0 || _endTime > _startTime, "Invalid auction time");

        AuctionInfo memory auction = AuctionInfo(
            address(0),
            _nftContract,
            _startTime,
            _endTime,
            false,
            _nftId,
            _minimumPrice,
            0,
            _nftUri
        );

        auctions[_auctionId] = auction;

        emit AuctionCreated(_auctionId, _nftId);

        return auctionId;
    }

    function settleAuction(uint256 _auctionId) public whenNotPaused {
        AuctionInfo storage auction = auctions[_auctionId];
        require(!auction.settled, "Auction already settled");
        uint256 highestBid = auction.highestBid;
        address highestBidder = auction.highestBidder;
        uint256 endTime = auction.endTime;
        require(
            endTime > 0 && block.timestamp > endTime,
            "Auction is still running"
        );

        auction.settled = true;
        if (highestBidder != address(0)) {
            auction.nftContract.safeMint(
                highestBidder,
                auction.nftId,
                auction.nftUri
            );

            address salesDestination = auction
                .nftContract
                .getPrimarySalesDestination();
            token.transfer(salesDestination, highestBid);
        }

        emit AuctionSettled(_auctionId, highestBidder, highestBid);
    }

    function getPercentageOfBid(uint256 _bid, uint256 _percentage)
        internal
        pure
        returns (uint256)
    {
        return (_bid * (_percentage)) / 10000;
    }

    function updateAuction(
        uint256 _auctionId,
        uint256 _minimumPrice,
        uint32 _endTime
    ) public onlyAdmin {
        require(!auctions[_auctionId].settled, "Auction already settled");
        require(auctions[_auctionId].endTime > 0, "Auction not found");
        AuctionInfo storage auction = auctions[_auctionId];
        auction.minimumPrice = _minimumPrice;
        auction.endTime = _endTime;
    }

    function cancelAuction(uint256 _auctionId) public onlyAdmin {
        AuctionInfo storage auction = auctions[_auctionId];
        require(!auction.settled, "Auction is already finished");
        reverseLastBid(_auctionId);
        auctions[_auctionId].settled = true;
        emit AuctionCancelled(_auctionId);
    }

    function bid(uint256 _auctionId, uint256 _amount)
        public
        nonReentrant
        whenNotPaused
    {
        AuctionInfo storage auction = auctions[_auctionId];
        uint256 endTime = auction.endTime;
        uint256 startTime = auction.startTime;
        uint256 timestamp = block.timestamp;
        require(timestamp >= startTime, "Auction not available");
        require(endTime == 0 || endTime > timestamp, "Auction has ended");
        require(!auction.settled, "Auction already settled");
        require(
            _amount > 0 && _amount >= auction.minimumPrice,
            "Bid is lower than minimum"
        );

        require(
            _amount >=
                (auction.highestBid * (10000 + bidIncrementPercentage)) / 10000,
            "Bid is lower than highest bid increment"
        );
        token.transferFrom(msg.sender, address(this), _amount);
        reverseLastBid(_auctionId);
        auction.highestBidder = msg.sender;
        auction.highestBid = _amount;

        uint256 timeExtension = defaultTimeExtension;

        if (endTime == 0) {
            auction.endTime = uint32(timestamp + DEFAULT_DURATION);
        } else {
            if (endTime - timestamp < timeExtension) {
                endTime = timestamp + timeExtension;
                auction.endTime = uint32(endTime);
            }
        }

        emit BidPlaced(_auctionId, msg.sender, _amount, endTime);
    }

    function reverseLastBid(uint256 _auctionId) private {
        AuctionInfo storage auction = auctions[_auctionId];
        address highestBidder = auction.highestBidder;
        uint256 highestBid = auction.highestBid;
        auction.highestBidder = address(0);
        auction.highestBid = 0;

        if (highestBidder != address(0)) {
            token.transfer(highestBidder, highestBid);
        }
    }

    function getAuction(uint256 _auctionId)
        public
        view
        returns (AuctionInfo memory)
    {
        return auctions[_auctionId];
    }

    function getDefaultTimeExtension() public view returns (uint256) {
        return defaultTimeExtension;
    }

    function getBidIncrementPercentage() public view returns (uint256) {
        return bidIncrementPercentage;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyAdmin
    {}
}
