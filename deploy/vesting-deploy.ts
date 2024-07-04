import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const [deployer] = await ethers.getSigners();

	const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

	const tokenName = process.env.DLP_TOKEN_NAME ?? "Custom Data Autonomy Token";
	const tokenSymbol = process.env.DLP_TOKEN_SYMBOL ?? "CUSTOMDAT";

	const datDeploy = await ethers.deployContract("DOH", [tokenName, tokenSymbol, ownerAddress]);

	console.log("DOH token deployed at:", datDeploy.target);

	const vestingDeploy = await upgrades.deployProxy(
		await ethers.getContractFactory("DOHVesting"),
		[
			datDeploy.target,
			ownerAddress,
			ethers.ZeroAddress
		],
		{
			kind: "uups"
		}
	);

	console.log(`DOHVesting deployed at:`, vestingDeploy.target);
};

export default func;
func.tags = ["DOHVesting"];
