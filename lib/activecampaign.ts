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
  private baseUrl: string | null = null;
  private apiKey: string | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;
    
    this.baseUrl = process.env.ACTIVECAMPAIGN_BASE_URL || '';
    this.apiKey = process.env.ACTIVECAMPAIGN_API_KEY || '';
    this.initialized = true;
  }

  private checkCredentials() {
    this.initialize();
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('ActiveCampaign API credentials not configured');
    }
  }

  private async request(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
    this.checkCredentials();
    const url = `${this.baseUrl}/api/3/${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Api-Token': this.apiKey!,
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

  // Get all tags
  async getTags() {
    try {
      const response = await this.request('tags');
      return response.tags || [];
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  }

  // Find or create a tag
  async findOrCreateTag(tagName: string) {
    try {
      // First, try to find existing tag by searching
      const searchResponse = await this.request(`tags?search=${encodeURIComponent(tagName)}`);
      const existingTag = searchResponse.tags?.find((tag: any) => tag.tag === tagName);

      if (existingTag) {
        console.log(`Tag "${tagName}" already exists in ActiveCampaign (ID: ${existingTag.id})`);
        return existingTag;
      }

      // Tag doesn't exist, create new one
      const createData = {
        tag: {
          tag: tagName,
          tagType: 'contact',
          description: `Company tag for ${tagName}`
        }
      };

      const createResponse = await this.request('tags', 'POST', createData);
      console.log(`Created new tag in ActiveCampaign: ${tagName} (ID: ${createResponse.tag.id})`);
      return createResponse.tag;

    } catch (error: any) {
      // If tag creation fails due to duplicate, it means it exists - fetch it by search
      if (error.message && error.message.includes('Duplicate entry')) {
        console.log(`Tag "${tagName}" already exists (duplicate error), fetching it...`);
        const searchResponse = await this.request(`tags?search=${encodeURIComponent(tagName)}`);
        const tag = searchResponse.tags?.find((t: any) => t.tag === tagName);
        if (tag) {
          console.log(`Found existing tag: ${tagName} (ID: ${tag.id})`);
          return tag;
        }
        console.error(`Tag "${tagName}" exists but couldn't be found!`);
      }

      console.error(`Error finding/creating tag ${tagName}:`, error);
      throw error;
    }
  }

  // Add tag to contact
  async addTagToContact(contactId: string, tagId: string) {
    try {
      const tagContactData = {
        contactTag: {
          contact: contactId,
          tag: tagId
        }
      };

      const response = await this.request('contactTags', 'POST', tagContactData);
      console.log(`Added tag ${tagId} to contact ${contactId}`);
      return response;
      
    } catch (error) {
      console.error(`Error adding tag ${tagId} to contact ${contactId}:`, error);
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

  // Enhanced method for SAM platform integration
  async addSamUserToList(email: string, firstName: string, lastName: string, company: 'InnovareAI' | '3CubedAI') {
    try {
      console.log(`🚀 Adding SAM user ${email} from ${company} to ActiveCampaign...`);
      
      // Find or create the contact
      const contact = await this.findOrCreateContact({
        email,
        firstName,
        lastName,
        fieldValues: []
      });

      // Find or create the SAM list
      const lists = await this.getLists();
      let samList = lists.find((list: any) => list.name === 'SAM');
      
      if (!samList) {
        console.log('SAM list not found, creating it...');
        const createListData = {
          list: {
            name: 'SAM',
            stringid: 'sam-users',
            sender_url: 'https://app.meet-sam.com',
            sender_reminder: 'You subscribed to SAM AI Platform updates',
            send_last_broadcast: 0,
            carboncopy: '',
            subscription_notify: '',
            unsubscription_notify: '',
            to_name: 'SAM User',
            optinoptout: 1,
            sender_name: company === 'InnovareAI' ? 'Sarah Powell - SAM AI' : 'Sophia Caldwell - SAM AI',
            sender_addr1: '',
            sender_addr2: '',
            sender_city: '',
            sender_state: '',
            sender_zip: '',
            sender_country: '',
            sender_phone: '',
            fulladdress: '',
            codepeek: 0,
            description: 'SAM AI Platform users from both InnovareAI and 3CubedAI'
          }
        };

        const listResponse = await this.request('lists', 'POST', createListData);
        samList = listResponse.list;
        console.log(`✅ Created SAM list: ${samList.id}`);
      }

      // Add contact to SAM list
      await this.addContactToList(contact.id, samList.id);

      // Find or create company tag
      const companyTag = await this.findOrCreateTag(company);

      // Add company tag to contact  
      await this.addTagToContact(contact.id, companyTag.id);
      
      console.log(`✅ Successfully added ${email} to SAM list with ${company} tag`);
      return { 
        success: true, 
        contactId: contact.id, 
        listId: samList.id, 
        tagId: companyTag.id,
        company: company
      };
      
    } catch (error) {
      console.error(`❌ Failed to add SAM user ${email}:`, error);
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