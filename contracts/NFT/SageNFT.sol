// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils/StringUtils.sol";
import "../../interfaces/ISageStorage.sol";

contract SageNFT is
    ERC721,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721URIStorage,
    Ownable
{
    ISageStorage immutable sageStorage;

    address constant TREASURY = 0x7AF3bA4A5854438a6BF27E4d005cD07d5497C33E;

    address public immutable artist;

    uint256 internal id;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    uint256 private constant DEFAULT_ROYALTY_PERCENTAGE = 1000; // in basis points (100 = 1%)

    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a; // implements ERC-2981 interface

    constructor(
        string memory _name,
        string memory _symbol,
        address _sageStorage,
        address _artist
    ) ERC721(_name, _symbol) {
        sageStorage = ISageStorage(_sageStorage);
        artist = _artist;
    }

    /**
     * @dev Throws if not called by an admin account.
     */
    modifier onlyAdmin() {
        require(
            sageStorage.hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Admin calls only"
        );
        _;
    }

    modifier onlyArtist() {
        require(msg.sender == artist, "Only artist calls");
        _;
    }

    function nextId() internal returns (uint256) {
        return id++;
    }

    function artistMint(address to, string calldata uri) public onlyArtist {
        uint256 tokenId = nextId();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function safeMint(address to, string calldata uri) public {
        require(
            sageStorage.hasRole(sageStorage.MINTER_ROLE(), msg.sender),
            "No minting rights"
        );
        uint256 tokenId = nextId();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function setTokenURI(uint256 _tokenId, string calldata _uri)
        public
        onlyAdmin
    {
        _setTokenURI(_tokenId, _uri);
    }

    function withdrawERC20(address erc20) public {
        IERC20 token = IERC20(erc20);
        uint256 balance = token.balanceOf(address(this));
        uint256 _artist = (balance * 8000) / 10000;
        token.transfer(owner(), _artist);
        token.transfer(TREASURY, balance - _artist);
    }

    function withdraw() public {
        uint256 balance = address(this).balance;
        uint256 _artist = (balance * 8000) / 10000;
        (bool sent, ) = owner().call{value: _artist}("");
        if (!sent) {
            revert();
        }
        (sent, ) = TREASURY.call{value: balance - _artist}("");
        if (!sent) {
            revert();
        }
    }

    receive() external payable {}

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function burnFromAuthorizedAddress(uint256 _id) public {
        require(
            sageStorage.hasRole(sageStorage.BURNER_ROLE(), msg.sender),
            "No burning rights"
        );
        _burn(_id);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        override(ERC721, IERC721)
        returns (bool)
    {
        if (
            sageStorage.getAddress(
                keccak256(abi.encodePacked("address.marketplace"))
            ) == operator
        ) {
            return true;
        }
        return super.isApprovedForAll(owner, operator);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return
            interfaceId == INTERFACE_ID_ERC2981 ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Calculates royalties based on a sale price provided following EIP-2981.
     * Solution is agnostic of the sale price unit and will answer using the same unit.
     * @return  address to receive royaltyAmount, amount to be paid as royalty.
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address, uint256)
    {
        return (
            address(this),
            (salePrice * DEFAULT_ROYALTY_PERCENTAGE) / 10000
        );
    }
}
