// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')

buyTickets = async (_lotteryId, lottery) => {
  const [...accounts] = await ethers.getSigners();
  await lottery.connect(accounts[0]).buyTicket(_lotteryId)
  await lottery.connect(accounts[1]).buyTicket(_lotteryId)
  await lottery.connect(accounts[2]).buyTicket(_lotteryId)
}

createLottery = async (lottery, memeX) => {
  const [...accounts] = await ethers.getSigners();
  deployer = accounts[0]
  _nftContract = memeX.address
  _prizeIds = [1, 2]
  _costPerTicket = 0


  //Research How to get current Time and Block in Hardhat
  var timestamp = Number(new Date());
  _startingTime = timestamp
  _closingTime = timestamp + 24 * 60 * 60
  lotteryId = lottery.createNewLottery(
    _costPerTicket,
    _startingTime,
    _closingTime,
    _nftContract,
    _prizeIds,
    0, 0,
    "https://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze.ipfs.dweb.link",
    3,
    {
      gasLimit: 4000000
    })

  return lotteryId

}

getStakingContract = async () => {
  rand_address = CONTRACTS[hre.network.name]["randomnessAddress"]
  const Randomness = await hre.ethers.getContractFactory("RandomNumberConsumer");
  return await Randomness.attach(rand_address);
}

getLotteryContract = async () => {
  lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"]
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  return await Lottery.attach(lottery_address);
}

getNFTContract = async () => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"]
  const NFT = await hre.ethers.getContractFactory("MemeXNFT");
  return await NFT.attach(nft_address);
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run('compile');
  const [...accounts] = await ethers.getSigners();
  deployer = accounts[0].address
  stake = await getStakingContract()
  lottery = await getLotteryContract()
  nft = await getNFTContract();
  // tx = await createLottery(lottery, nft)
  // const receipt = await tx.wait();
  lotteryId = (await lottery.getCurrentLotteryId()).toNumber();
  // await buyTickets(lotteryId, lottery);
  // tx = await lottery.boostParticipant(lotteryId, accounts[1].address, { gasLimit: 4000000 });
  // await tx.wait();
  tx = await lottery.drawWinningNumbers(lotteryId, 0, { gasLimit: 4000000 });
  await tx.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
