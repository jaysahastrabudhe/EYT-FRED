/**
 * Zoho CRM Web-to-Lead Configuration
 * 
 * Replace these placeholder values with your actual Zoho CRM Web-to-Lead form credentials.
 * You can find these values in your Zoho CRM account under:
 * Settings > Developer Space > Webforms > Create Webform.
 */
window.ZOHO_CONFIG = {
  // The action URL for lead submission (usually crm.zoho.com or crm.zoho.in depending on your region)
  // For India (CRM Region IN), use: https://crm.zoho.in/crm/WebToLeadForm
  // For USA/Global (CRM Region US), use: https://crm.zoho.com/crm/WebToLeadForm
  submitUrl: 'https://crm.zoho.in/crm/WebToLeadForm',

  // System generated form ID values from Zoho CRM Web-to-Lead HTML code
  xnQsjsdp: 'YOUR_ZOHO_FORM_ID_PLACEHOLDER_xnQsjsdp',
  xmGndsaC: 'YOUR_ZOHO_FORM_ID_PLACEHOLDER_xmGndsaC',
  actionType: 'TGVhZHM=', // 'TGVhZHM=' is the base64 code for 'Leads'

  // If you configure a thank you URL redirect in Zoho, you can specify it here or handle it client-side.
  returnURL: window.location.href,

  // Zoho field name mappings (Replace these with the exact names/custom field IDs from your CRM)
  fields: {
    lastName: 'Last Name',         // Required standard field in Zoho Lead
    firstName: 'First Name',       // Optional standard field
    email: 'Email',               // Standard field
    phone: 'Phone',               // Standard field
    dob: 'COB_Date_Of_Birth',     // Custom Field for DOB (e.g. COB_Date_Of_Birth or Date of Birth)
    relocation: 'Relocation_Willingness', // Custom Field for relocation willingness
    registrationType: 'Registration_Type', // Custom Field: "Individual" or "Team"
    
    // Custom tags or flags we want to add to Zoho CRM
    // These tags map to: Sprint Attended, Priority Review, Relocation-Confirmed, Sprint-Fee-Paid
    leadSource: 'Lead Source', // Set to "Founder Sprint Landing Page"
    description: 'Description', // Save teammates info here if registering as team
    leadStatus: 'Lead Status', // Set to "Sprint-Fee-Paid"
    leadTags: 'Tag' // Zoho Lead tags (comma-separated string, e.g. "Sprint-Fee-Paid, Relocation-Confirmed")
  }
};
