/* Set endpoint only after the receiving service has been configured and tested.
 * Leave it empty for a preview: no visitor information will be transmitted.
 * The endpoint must accept JSON and return { "success": true } on acceptance.
 */
window.HRAH_FORM_CONFIG = {
  endpoint: '',
  consentVersion: 'original'
};
