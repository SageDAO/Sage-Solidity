const { expect } = require("chai");
const { ethers } = require("hardhat");
const keccak256 = require("keccak256");

const MINTER_ROLE = keccak256("MINTER_ROLE");
const BURNER_ROLE = keccak256("BURNER_ROLE");

const basePath = "ipfs://path/";

describe("NFT Contract", () => {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
        Nft = await ethers.getContractFactory("SageNFT");
        _lotteryAddress = addr1.address;
        nft = await upgrades.deployProxy(Nft, ["Sage", "SAGE"], {
            kind: "uups"
        });
        await nft.grantRole(MINTER_ROLE, _lotteryAddress);

        await nft.createDrop(1, addr1.address, 200, basePath, addr1.address);
        await nft.grantRole(MINTER_ROLE, addr2.address);
        _id = 1;
        await nft.connect(addr2).safeMint(addr2.address, _id, 1);
    });

    it("Should increase minter balance", async function() {
        expect(await nft.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should answer correct uri", async function() {
        expect(await nft.tokenURI(_id)).to.equal(basePath + _id);
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
        await nft.grantRole(BURNER_ROLE, addr3.address);
        await nft.connect(addr3).burnFromAuthorizedSC(_id);
    });

    it("Should not be able to burn any token if not authorized SC", async function() {
        await expect(
            nft.connect(addr3).burnFromAuthorizedSC(_id)
        ).to.be.revertedWith("NFT: No burn privileges");
    });

    it("Should not mint without minter role", async function() {
        await expect(nft.connect(addr3).safeMint(addr2.address, 1, 1)).to.be
            .reverted;
    });

    it("Should calculate royalties", async function() {
        royaltyInfo = await nft.royaltyInfo(1, 100);
        expect(royaltyInfo[0]).to.equal(addr1.address);
        expect(royaltyInfo[1]).to.equal(2);
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
