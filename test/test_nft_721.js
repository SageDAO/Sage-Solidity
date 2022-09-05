const { expect } = require("chai");
const { ethers } = require("hardhat");

const uri = "ipfs://aaaa/";

describe("NFT Contract", () => {
    beforeEach(async () => {
        [
            owner,
            addr1,
            addr2,
            addr3,
            artist,
            ...addrs
        ] = await ethers.getSigners();
        SageStorage = await ethers.getContractFactory("SageStorage");
        sageStorage = await SageStorage.deploy();

        NftFactory = await ethers.getContractFactory("NFTFactory");
        nftFactory = await NftFactory.deploy(sageStorage.address);
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.admin", nftFactory.address]
            ),
            true
        );
        await nftFactory.deployByAdmin(artist.address, "Sage test", "SAGE");

        nftContractAddress = await nftFactory.getContractAddress(
            artist.address
        );
        nft = await ethers.getContractAt("SageNFT", nftContractAddress);
        _lotteryAddress = addr1.address;
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.minter", _lotteryAddress]
            ),
            true
        );
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.minter", addr2.address]
            ),
            true
        );
        _id = 1;

        await nft.connect(addr2).safeMint(addr2.address, _id, uri);
    });

    it("Should increase minter balance", async function() {
        expect(await nft.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should answer correct uri", async function() {
        expect(await nft.tokenURI(_id)).to.equal(uri);
    });

    it("Should revert trying to mint same id", async function() {
        await expect(
            nft.connect(addr2).safeMint(addr2.address, 1, uri)
        ).to.be.revertedWith("ERC721: token already minted");
    });

    it("Should be able to burn", async function() {
        expect(await nft.balanceOf(addr2.address)).to.equal(1);
        await nft.connect(addr2).burn(_id);
        expect(await nft.balanceOf(addr2.address)).to.equal(0);
    });

    it("Should not be able to burn other user's NFTs", async function() {
        await expect(nft.connect(addr1).burn(_id)).to.be.revertedWith(
            "ERC721Burnable: caller is not owner nor approved"
        );
    });

    it("Should be able to burn any token from authorized SC", async function() {
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.burner", addr3.address]
            ),
            true
        );
        await nft.connect(addr3).burnFromAuthorizedAddress(_id);
    });

    it("Should not be able to burn any token if not authorized SC", async function() {
        await expect(
            nft.connect(addr3).burnFromAuthorizedAddress(_id)
        ).to.be.revertedWith("No burning rights");
    });

    it("Should not mint without minter role", async function() {
        await expect(nft.connect(addr3).safeMint(addr2.address, 1, 1)).to.be
            .reverted;
    });

    it("Should calculate royalties", async function() {
        royaltyInfo = await nft.royaltyInfo(1, 100);
        expect(royaltyInfo[0]).to.equal(nft.address);
        expect(royaltyInfo[1]).to.equal(10);
    });

    it("Should transfer from a to b", async function() {
        await nft.connect(addr2).transferFrom(addr2.address, addr3.address, 1);
        expect(await nft.balanceOf(addr2.address)).to.equal(0);
        expect(await nft.balanceOf(addr3.address)).to.equal(1);
    });

    it("Should signal implementation of EIP-2981", async function() {
        const INTERFACE_ID_ERC2981 = 0x2a55205a;

        expect(await nft.supportsInterface(INTERFACE_ID_ERC2981)).to.equal(
            true
        );
    });
});