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
The SDK (in this case more of a library) provides you with these methods.
* `redirectSca.initState()`
* `redirectSca.returnNextRedirect()`
* `redirectSca.continueRedirect()`
* `redirectSca.abortSca()`

This SDK tries to propagate errors from the banking provider.
Errors show up to the TPP in form of the query parameter `redirect-sca-error` appended to the callback URL.

You can learn more about them by looking into the documentation inside of `src/redirect-sca-sdk.js`

Minimal example usage after embedding the SDK from `dist/` in a `<script>`-tag:
```js
await redirectSca.initState();
let nextRedirectDirection = await redirectSca.returnNextRedirect(); // CUSTOMER or PROVIDER
console.log(nextRedirectDirection);
redirectSca.continueRedirect();
```
Sample implementation can be found at [https://banksapi.io/redirect/](https://banksapi.io/redirect/)
