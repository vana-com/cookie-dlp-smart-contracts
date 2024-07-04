// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DOHVesting is
UUPSUpgradeable,
PausableUpgradeable,
Ownable2StepUpgradeable,
AccessControlUpgradeable,
ReentrancyGuardUpgradeable
{
    IERC20 public doh;
    address public claimManager;
    uint256 public totalVestingAmount;
    uint256 public totalClaimedAmount;
    mapping(address => uint256) public claims;

    using SafeERC20 for IERC20;

    /**
    * @dev Emitted when the claimManager is updated.
    *
    * @param oldClaimManager    the old claimManager address
    * @param newClaimManager    the new claimManager address
    */
    event ClaimManagerUpdated(address indexed oldClaimManager, address indexed newClaimManager);

    /**
     * @dev The caller account is not authorized to perform an claimManager operation.
     */
    error UnauthorizedClaimManagerAction();

    /**
     * @dev The user has already claimed
     */
    error AlreadyClaimed();

    /**
     * @dev There are not enough funds into contract
     */
    error NotEnoughFunds();



    modifier onlyClaimManager() {
        if (msg.sender != claimManager) {
            revert UnauthorizedClaimManagerAction();
        }
        _;
    }

    /**
     * @notice Initialize the contract
     */
    function initialize(address dohAddress, address ownerAddress, address claimManagerAddress) external initializer {
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        doh = IERC20(dohAddress);
        claimManager = claimManagerAddress;

        _transferOwnership(ownerAddress);
    }

    /**
     * @notice Upgrade the contract
     * This function is required by OpenZeppelin's UUPSUpgradeable
     *
     * @param newImplementation                  new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * return the veriosn of the contract
     */
    function version() external pure returns (uint256) {
        return 1;
    }

    /**
     * @dev Pauses the contract
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Changes mintManager address
     */
    function updateClaimManager(address newClaimManager) external virtual onlyOwner {
        address oldClaimManager = claimManager;
        claimManager = newClaimManager;
        emit ClaimManagerUpdated(oldClaimManager, newClaimManager);
    }

    /**
     * @notice Add rewards to the contract
     */
    function increaseVestingAmount(uint256 amount) external onlyClaimManager nonReentrant {
        doh.safeTransferFrom(msg.sender, address(this), amount);
        totalVestingAmount += amount;
    }

    /**
     * @notice Claim rewards
     *
     * @param to                             the address to claim to
     * @param amount                         the amount to claim
     */
    function claim(address to, uint256 amount) external virtual onlyClaimManager whenNotPaused {
        if (claims[to] > 0) {
            revert AlreadyClaimed();
        }

        if ((totalClaimedAmount + amount > totalVestingAmount) || (doh.balanceOf(address(this)) < amount)) {
            revert NotEnoughFunds();
        }

        totalClaimedAmount += amount;
        doh.safeTransfer(to, amount);
        claims[to] = amount;
    }
}
