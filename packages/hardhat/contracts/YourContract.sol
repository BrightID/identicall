//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract YourContract {
	mapping(string => string[]) public partiesAndSecrets;

	event PartyAndSecretAdded(string programId, string partyAndSecret);

	function addPartyAndSecret(string memory _programId, string memory _partyAndSecret) public {
		partiesAndSecrets[_programId].push(_partyAndSecret);
		emit PartyAndSecretAdded(_programId, _partyAndSecret);
	}

	function getPartiesAndSecrets(string memory _programId) public view returns (string[] memory) {
		return partiesAndSecrets[_programId];
	}

	function getPartiesAndSecretsCount(string memory _programId) public view returns (uint) {
		return partiesAndSecrets[_programId].length;
	}
}
