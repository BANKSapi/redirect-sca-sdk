const helper = require('./redirect-sca-helper.js');
const redirectSca = {};

/**
 * @typedef State
 * @property {string} callbackUrl URL given by the tenant (customer) which the user will be directed towards when authentication completes
 * @property {string} forwardUrl URL of the provider to which the user will be forwarded
 * @property {string} session Session ID that is needed by BANKSapi
 * @property {string} consent Consent ID which is needed by BANKSapi
 * @property {boolean} sessionStorageFilled Boolean value that represents if the state is kept in SessionStorage
 */

/**
 * Initializes the state by reading the query parameters or the sessionStorage
 * respectively. It needs to be called before any other method. 
 * Pollutes the sessionStorage namespace beginning with "sca:".
 * @param {string} baseUrl can either be https://test.banksapi.io or https://banksapi.io
 * @returns {Promise<State>} returns resolved promise with state as soon as application state has been initialized
 */
function initState(baseUrl) {
    return helper.initState(baseUrl).then(state => {
        redirectSca.state = state;
        redirectSca.baseUrl = baseUrl;
        return Promise.resolve(redirectSca.state);
    }).catch(error => Promise.reject(error));
}

/**
 * Optional helper method, that returns the direction of the next redirection. No side effects.
 * @returns {Promise<'PROVIDER'|'CUSTOMER'>} indicating next direction for redirect, can either be "PROVIDER"
 * or "CUSTOMER"
 */
function returnNextRedirect() {
    if (!redirectSca.state) {
        return Promise.reject(new Error('state not initialized'));
    }

    if (!redirectSca.state.sessionStorageFilled) {
        return Promise.resolve('PROVIDER');
    } else {
        return Promise.resolve('CUSTOMER');
    }
}

/**
 * Continues with the redirect by modifying the value of window.location
 * @returns {Promise<string>} url that your should be redirected to automatically.
 * If the automatic redirect did not work use this url to redirect manually.
 */
function continueRedirect() {
    return returnNextRedirect().then(continueTo => {
        switch (continueTo) {
            case 'PROVIDER':
                return helper.continueToProvider(redirectSca.baseUrl, redirectSca.state);
            case 'CUSTOMER':
                return helper.continueToCustomer(redirectSca.baseUrl);
        }
    });
}

/**
 * Aborts the redirect SCA process. If possible the authentication will be aborted and
 * the user is being redirected to the tenant with an 'redirect-sca-error' query parameter.
 * Otherwise the promise will be rejected.
 * @returns {Promise<Response>} rejected if no callback could be performed
 */
function abortSca() {
    return helper.abortSca();
}

module.exports = {
    initState: initState,
    returnNextRedirect: returnNextRedirect,
    continueRedirect: continueRedirect,
    abortSca: abortSca
};