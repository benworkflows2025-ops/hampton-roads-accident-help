/* Set endpoint only after the receiving service has been configured and tested.
 * Leave it empty for a preview: no visitor information will be transmitted.
 * The endpoint must accept JSON and return { "success": true } on acceptance.
 */
window.HRAH_FORM_CONFIG = {
  endpoint: 'https://services.leadconnectorhq.com/hooks/B3UAjI7YdFTLnLcCmHCX/webhook-trigger/2ac07b36-e38a-456b-82a4-c576cd7bc92a',
  consentVersion: 'original'
};
