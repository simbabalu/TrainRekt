require('react-native-get-random-values');

if (typeof __DEV__ !== 'undefined' && __DEV__) {
	const bootstrapCrypto = globalThis.crypto;
	const getRandomValuesType = bootstrapCrypto && bootstrapCrypto.getRandomValues
		? typeof bootstrapCrypto.getRandomValues
		: 'undefined';
	console.log(
		`[BOOTSTRAP] crypto=${typeof bootstrapCrypto} getRandomValues=${getRandomValuesType}`,
	);
}

require('expo-router/entry');
