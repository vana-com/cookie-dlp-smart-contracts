import chai, {should} from "chai";
import chaiAsPromised from "chai-as-promised";
import {ethers, upgrades} from "hardhat";
import {DOH, DOHVesting} from "../typechain-types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {parseEther} from "ethers";

chai.use(chaiAsPromised);
should();

describe("DOHVesting", () => {
    let deployer: HardhatEthersSigner;
    let owner: HardhatEthersSigner;
    let claimManager: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let user3: HardhatEthersSigner;
    let user4: HardhatEthersSigner;

    let token: DOH;
    let vesting: DOHVesting;

    let initailVestingAmount = parseEther("1000000");

    const deploy = async () => {
        [deployer, owner, claimManager, user1, user2, user3, user4] = await ethers.getSigners();

        //deploy doh token
        const tokenDeploy = await ethers.deployContract("DOH", ["Cookie Data Autonomy Token", "DOH", owner.address]);
        token = await ethers.getContractAt("DOH", tokenDeploy.target);

        //deploy datVesting
        const vestingDeploy = await upgrades.deployProxy(
            await ethers.getContractFactory("DOHVesting"),
            [
                token.target,
                owner.address,
                claimManager.address
            ],
            {
                kind: "uups"
            }
        );

        vesting = await ethers.getContractAt("DOHVesting", vestingDeploy.target);

        await token.connect(owner).mint(claimManager.address, initailVestingAmount);

        await token.connect(claimManager).approve(vesting, initailVestingAmount);
        await vesting.connect(claimManager).increaseVestingAmount(initailVestingAmount);
    }

    describe("DOH - basic", () => {
        before(async function () {
        });

        beforeEach(async () => {
            await deploy();
        });

        it("should have correct params after deploy", async function () {
            (await vesting.doh()).should.eq(token);
            (await vesting.version()).should.eq(1);
            (await vesting.owner()).should.eq(owner);
            (await vesting.claimManager()).should.eq(claimManager);
            (await vesting.paused()).should.eq(false);
            (await vesting.totalVestingAmount()).should.eq(initailVestingAmount);
            (await vesting.totalClaimedAmount()).should.eq(0);
        });

        it("should transferOwnership in 2 steps", async function () {
            await vesting.connect(owner).transferOwnership(user2.address)
                .should.emit(vesting, "OwnershipTransferStarted")
                .withArgs(owner, user2);
            (await vesting.owner()).should.eq(owner);

            await vesting.connect(owner).transferOwnership(user3.address)
                .should.emit(vesting, "OwnershipTransferStarted")
                .withArgs(owner, user3);
            (await vesting.owner()).should.eq(owner);

            await vesting.connect(user3).acceptOwnership()
                .should.fulfilled;
            (await vesting.owner()).should.eq(user3);
        });

        it("should updateClaimManager when owner", async function () {
            await vesting.connect(owner).updateClaimManager(user2.address)
                .should.emit(vesting, "ClaimManagerUpdated")
                .withArgs(claimManager, user2);
            (await vesting.claimManager()).should.eq(user2);
        });

        it("should reject updateClaimManager when non-owner", async function () {
            await vesting.connect(user2)
                .updateClaimManager(user3.address)
                .should.be.rejectedWith(
                    `OwnableUnauthorizedAccount("${user2.address}")`
                );
        });

        it("should pause when owner", async function () {
            await vesting.connect(owner).pause()
                .should.emit(vesting, "Paused")
                .withArgs(owner.address);
            (await vesting.paused()).should.eq(true);
        });

        it("should reject pause when non-owner", async function () {
            await vesting.connect(user2)
                .pause()
                .should.be.rejectedWith(
                    `OwnableUnauthorizedAccount("${user2.address}")`
                );
        });

        it("should unpause when owner", async function () {
            await vesting.connect(owner).pause();

            await vesting.connect(owner).unpause()
                .should.emit(vesting, "Unpaused")
                .withArgs(owner.address);
            (await vesting.paused()).should.eq(false);
        });

        it("should reject unpause when non-owner", async function () {
            await vesting.connect(owner).pause();

            await vesting.connect(user2)
                .unpause()
                .should.be.rejectedWith(
                    `OwnableUnauthorizedAccount("${user2.address}")`
                );
        });

        it("should increaseVestingAmount when claimManager", async function () {
            await token.connect(owner).mint(claimManager.address, parseEther("100"));

            await token.connect(claimManager).approve(vesting, parseEther("100"));
            await vesting.connect(claimManager).increaseVestingAmount(parseEther("100"));

            (await vesting.totalVestingAmount()).should.eq(initailVestingAmount + parseEther("100"));

            (await token.balanceOf(vesting)).should.eq(initailVestingAmount + parseEther("100"));
        });

        it("should reject increaseVestingAmount when non-claimManager", async function () {
            await token.connect(owner).mint(user2.address, parseEther("100"));

            await token.connect(user2).approve(vesting, parseEther("100"));
            await vesting.connect(user2).increaseVestingAmount(parseEther("100"))
                .should.be.rejectedWith(
                    `UnauthorizedClaimManagerAction()`
                );
        });

        it("should claim when claimManager", async function () {
            await vesting.connect(claimManager).claim(user2.address, parseEther("100"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user2, parseEther("100"));

            (await vesting.totalClaimedAmount()).should.eq(parseEther("100"));
            (await vesting.totalVestingAmount()).should.eq(initailVestingAmount);
            (await vesting.claims(user2)).should.eq(parseEther("100"));

            (await token.balanceOf(user2.address)).should.eq(parseEther("100"));
            (await token.balanceOf(vesting)).should.eq(initailVestingAmount - parseEther("100"));
        });

        it("should reject claim when non-claimManager", async function () {
            await vesting.connect(user2).claim(user2.address, parseEther("100"))
                .should.be.rejectedWith(
                    `UnauthorizedClaimManagerAction()`
                );
        });

        it("should claim all when claimManager", async function () {
            await vesting.connect(claimManager).claim(user2.address, initailVestingAmount)
                .should.emit(token, "Transfer")
                .withArgs(vesting, user2, initailVestingAmount);

            (await vesting.totalClaimedAmount()).should.eq(initailVestingAmount);
            (await vesting.totalVestingAmount()).should.eq(initailVestingAmount);
            (await vesting.claims(user2)).should.eq(initailVestingAmount);

            (await token.balanceOf(user2.address)).should.eq(initailVestingAmount);
            (await token.balanceOf(vesting)).should.eq(0);
        });

        it("should reject claim when claim more than totalVestingAmount #1", async function () {
            await vesting.connect(claimManager).claim(user2.address, initailVestingAmount + parseEther("100"))
                .should.be.rejectedWith(
                    `NotEnoughFunds()`
                );
        });

        it("should reject claim when claim more than totalVestingAmount #2", async function () {
            await vesting.connect(claimManager).claim(user2.address, initailVestingAmount - parseEther("100"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user2, initailVestingAmount - parseEther("100"));

            await vesting.connect(claimManager).claim(user3.address, parseEther("101"))
                .should.be.rejectedWith(
                    `NotEnoughFunds()`
                );
        });

        it("should reject claim when already claimed", async function () {
            await vesting.connect(claimManager).claim(user2.address, parseEther("100"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user2, parseEther("100"));

            await vesting.connect(claimManager).claim(user2.address, parseEther("100"))
                .should.be.rejectedWith(
                    `AlreadyClaimed()`
                );
        });

        it("should claim multiple times for multiple users", async function () {
            await vesting.connect(claimManager).claim(user1.address, parseEther("100"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user1, parseEther("100"));

            await vesting.connect(claimManager).claim(user2.address, parseEther("200"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user2, parseEther("200"));

            await vesting.connect(claimManager).claim(user3.address, parseEther("300"))
                .should.emit(token, "Transfer")
                .withArgs(vesting, user3, parseEther("300"));

            (await vesting.totalClaimedAmount()).should.eq(parseEther("600"));
            (await vesting.totalVestingAmount()).should.eq(initailVestingAmount);
            (await vesting.claims(user1)).should.eq(parseEther("100"));
            (await vesting.claims(user2)).should.eq(parseEther("200"));
            (await vesting.claims(user3)).should.eq(parseEther("300"));
            (await token.balanceOf(vesting)).should.eq(initailVestingAmount - parseEther("600"));
            (await token.balanceOf(user1.address)).should.eq(parseEther("100"));
            (await token.balanceOf(user2.address)).should.eq(parseEther("200"));
            (await token.balanceOf(user3.address)).should.eq(parseEther("300"));
        });
    });
});