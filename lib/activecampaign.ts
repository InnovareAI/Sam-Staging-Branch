interface ActiveCampaignContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fieldValues?: Array<{
    field: string;
    value: string;
  }>;
}

interface ActiveCampaignList {
  id: string;
  name: string;
  stringid: string;
}

class ActiveCampaignService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.ACTIVECAMPAIGN_BASE_URL || '';
    this.apiKey = process.env.ACTIVECAMPAIGN_API_KEY || '';
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('ActiveCampaign API credentials not configured');
    }
  }

  private async request(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
    const url = `${this.baseUrl}/api/3/${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Api-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ActiveCampaign API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ActiveCampaign API request failed:', error);
      throw error;
    }
  }

  // Get all lists
  async getLists(): Promise<ActiveCampaignList[]> {
    const response = await this.request('lists');
    return response.lists || [];
  }

  // Find or create a contact
  async findOrCreateContact(contactData: ActiveCampaignContact) {
    try {
      // First, try to find existing contact by email
      const searchResponse = await this.request(`contacts?email=${encodeURIComponent(contactData.email)}`);
      
      if (searchResponse.contacts && searchResponse.contacts.length > 0) {
        console.log(`Contact ${contactData.email} already exists in ActiveCampaign`);
        return searchResponse.contacts[0];
      }

      // Contact doesn't exist, create new one
      const createData = {
        contact: {
          email: contactData.email,
          firstName: contactData.firstName || '',
          lastName: contactData.lastName || '',
          phone: contactData.phone || '',
          fieldValues: contactData.fieldValues || []
        }
      };

      const createResponse = await this.request('contacts', 'POST', createData);
      console.log(`Created new contact in ActiveCampaign: ${contactData.email}`);
      return createResponse.contact;
      
    } catch (error) {
      console.error(`Error finding/creating contact ${contactData.email}:`, error);
      throw error;
    }
  }

  // Add contact to list
  async addContactToList(contactId: string, listId: string) {
    try {
      const subscriptionData = {
        contactList: {
          list: listId,
          contact: contactId,
          status: 1 // 1 = active, 0 = unconfirmed, 2 = unsubscribed
        }
      };

      const response = await this.request('contactLists', 'POST', subscriptionData);
      console.log(`Added contact ${contactId} to list ${listId}`);
      return response;
      
    } catch (error) {
      console.error(`Error adding contact ${contactId} to list ${listId}:`, error);
      throw error;
    }
  }

  // Main method to add new member to list
  async addNewMemberToList(email: string, firstName: string, lastName: string, listId: string, additionalData?: any) {
    try {
      console.log(`Adding ${email} to ActiveCampaign list ${listId}...`);
      
      // Find or create the contact
      const contact = await this.findOrCreateContact({
        email,
        firstName,
        lastName,
        fieldValues: additionalData?.fieldValues || []
      });

      // Add contact to the specified list
      await this.addContactToList(contact.id, listId);
      
      console.log(`✅ Successfully added ${email} to ActiveCampaign list ${listId}`);
      return { success: true, contactId: contact.id };
      
    } catch (error) {
      console.error(`❌ Failed to add ${email} to ActiveCampaign list ${listId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.request('lists?limit=1');
      console.log('✅ ActiveCampaign connection successful');
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ ActiveCampaign connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export const activeCampaignService = new ActiveCampaignService();
export type { ActiveCampaignContact, ActiveCampaignList };