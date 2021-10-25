# Redirect SCA SDK
This is a small SDK helping TPPs to implement BANKSapi's Redirect Component on their domain to
be compliant with the regulatory requirements of XS2A's redirect SCA flow.

## Build
```
npm install
```
then either:
`npm run start` to enter development mode
or 
`npm run build` to build a bundled version to `dist/`.

## Usage
The SDK (in this case more of a library) provides you with 3 methods.
* `redirectSca.initState(baseUrl)`
* `redirectSca.returnNextRedirect()`
* `redirectSca.continueRedirect()`

you can learn more about them by looking into the documentation inside of `src/redirect-sca-sdk.js`

Example usage after embedding the SDK from `dist/` in a `<script>`-tag:
```js
const baseUrl = 'https://test.banksapi.io';
await redirectSca.initState(baseUrl);
let nextRedirectDirection = await redirectSca.returnNextRedirect(); // CUSTOMER or PROVIDER
console.log(nextRedirectDirection);
redirectSca.continueRedirect();
```
