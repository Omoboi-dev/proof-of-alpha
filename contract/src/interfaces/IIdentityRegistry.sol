// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIdentityRegistry — ERC-8004 Identity Registry (subset)
/// @notice Each agent is an ERC-721 token whose tokenId is the agentId.
/// @dev Faithful to EIP-8004 v1 (https://eips.ethereum.org/EIPS/eip-8004).
///      Only the members this project needs are declared here.
interface IIdentityRegistry {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    /// @notice Register a new agent. Mints an ERC-721 to msg.sender.
    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        returns (uint256 agentId);

    function register(string calldata agentURI) external returns (uint256 agentId);

    function register() external returns (uint256 agentId);

    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice The operational wallet an agent signs/acts from (may differ from NFT owner).
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice ERC-721 owner of the agentId (the controller of the agent).
    function ownerOf(uint256 agentId) external view returns (address);
}
