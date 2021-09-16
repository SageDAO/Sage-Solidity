const { parseBytes32String } = require("@ethersproject/strings");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Wallet } = require('ethers');

const rewardRateToken = 1;
const rewardRateLiquidity = 2;
const TEN_POW_18 = "1000000000000000000";

function range(start, end) {
    return Array(end - start + 1).fill().map((_, idx) => start + idx)
  }
  

describe("Lottery Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        [owner, ...accounts] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFTBasic");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.setLotteryContract(lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        // create a new lottery
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        var prizeIds = range(1,100)

        
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 500000,
            nft.address, prizeIds,
            ethers.utils.parseEther("1"), 0);

    });

    it("Check new lottery created", async function () {
        expect(await lottery.getCurrentLotteryId()).to.equal(1);
    });

    it("User buys 1 lottery ticket", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(1);
    });



    it('Buy Tickets with lots of accounts', async function() {
        await rewards.join();
        
        for (let i = 1; i< 100; i++){
            await token.connect(owner).transfer(accounts[i].address,1)
            await rewards.connect(accounts[i]).join();
            await lottery.connect(accounts[i]).buyTickets(1,1)  
            console.log(await lottery.getNumberOfParticipants(1)) 
        
    }

        await lottery.drawWinningNumbers(1);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");
        for(let i = 1; i<100;i++){
            result = await lottery.connect(accounts[i]).isCallerWinner(1);
            console.log(`Is ${accounts[i].address} winner,:`,result[0])
            console.log("Prize Id:",result[1])
            console.log("Claimed:",result[2])
        }
        
        // await lottery.redeemNFT(1);
        // result = await lottery.isCallerWinner(1);
        // console.log("Is 1 winner,:",result[0])
        // console.log("Prize Id:",result[1])
        // console.log("Claimed:",result[2])
    })

    
    it("Same user buys a second ticket", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(2);
    });


    it("User buys 10 lottery tickets", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 10);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(10);
    });

    it("Lottery full - should revert", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1],
            ethers.utils.parseEther("1"),
            1 // just one participant allowed
        );
        await lottery.buyTickets(2, 1);
        // should fail on the second entry
        await expect(lottery.connect(addr1).buyTickets(2, 1)).to.be.revertedWith("Lottery is full");
    });

    it("User boosts", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") });
        expect(await lottery.getTotalEntries(1)).to.equal(2);
        expect(await lottery.isBooster(1, owner.address)).to.equal(true);
    });

    it("User tries to enter when lottery is not open", async function () {
        await rewards.join();
        await ethers.provider.send("evm_increaseTime", [10000000000]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1)).to.be.revertedWith("Lottery is not open");
    });


    it("User tries to boost without sending funds - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("0") })).to.be.reverted;
    });

    it("User tries to boost without buying ticket first - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.reverted;
    });

    it("User tries to buy ticket with wrong lottery id - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(2, 1)).to.be.reverted;
    });

    it("User tries to boost with wrong lottery id - should revert", async function () {
        await rewards.join();
        await ethers.provider.send("evm_mine", []);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(2, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.reverted;
    });

    it("Run Lottery with 1 participant - mint prize only once", async function () {
        await rewards.join();
        await lottery.buyTickets(1, 1);
        await lottery.drawWinningNumbers(1);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true);  // winner
        console.log("Prize Id:",result[1])     // prize 1
        expect(result[2]).to.equal(false); // not claimed
        await lottery.redeemNFT(1);
        result = await lottery.isCallerWinner(1);
        expect(result[0]).to.equal(true); // winner
        console.log("Prize Id:",result[1])   // prize 1
        expect(result[2]).to.equal(true); // claimed
        // should allow to mint only once
        await expect(lottery.redeemNFT(1)).to.be.revertedWith("Participant already claimed prize");
    });

    it("Run lottery with more participants", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        // creating lottery with id = 2
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1],
            ethers.utils.parseEther("1"), 0);
        await lottery.buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.connect(addr2).buyTickets(2, 1);

        await lottery.drawWinningNumbers(2);
        expect(await mockRng.fulfillRequest(1)).to.have.emit(lottery, "ResponseReceived");

    });

});