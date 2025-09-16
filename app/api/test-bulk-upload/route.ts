import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const testProspects = [
    {
      email_address: "john.doe@techcorp.com",
      full_name: "John Doe",
      first_name: "John",
      last_name: "Doe",
      job_title: "Software Engineer",
      company_name: "TechCorp Inc",
      location: "San Francisco, CA",
      linkedin_profile_url: "https://linkedin.com/in/john-doe"
    },
    {
      email_address: "jane.smith@innovate.co",
      full_name: "Jane Smith",
      first_name: "Jane",
      last_name: "Smith", 
      job_title: "Product Manager",
      company_name: "Innovate Co",
      location: "New York, NY"
    },
    {
      // Duplicate of John Doe - should be automatically detected
      email_address: "john.doe@techcorp.com",
      full_name: "John Doe",
      job_title: "Senior Software Engineer", // Different title
      company_name: "TechCorp Inc"
    },
    {
      // No email, only LinkedIn
      linkedin_profile_url: "https://linkedin.com/in/mike-johnson",
      full_name: "Mike Johnson",
      job_title: "Sales Director",
      company_name: "Sales Pro LLC"
    },
    {
      // Invalid prospect - missing identifiers
      full_name: "Invalid Person",
      company_name: "No Contact Info"
    }
  ];

  const bulkUploadPayload = {
    workspaceId: "demo-workspace-id", // You'll need to replace with actual workspace ID
    prospects: testProspects,
    filename: "test_bulk_upload.csv",
    dataSource: "test_upload"
  };

  return NextResponse.json({
    message: "Test data for bulk prospect upload with automatic deduplication",
    explanation: {
      "Prospect 1": "John Doe - New prospect, should be created",
      "Prospect 2": "Jane Smith - New prospect, should be created", 
      "Prospect 3": "John Doe duplicate - Should be automatically detected and either updated or skipped",
      "Prospect 4": "Mike Johnson - LinkedIn only, should be created",
      "Prospect 5": "Invalid prospect - Missing identifiers, should be rejected with validation error"
    },
    expected_results: {
      total_uploaded: 5,
      validation_errors: 1,
      valid_prospects: 4,
      new_prospects: 3,
      updated_prospects: 0,
      duplicate_prospects: 1,
      failed_prospects: 0
    },
    test_payload: bulkUploadPayload,
    usage: "POST this payload to /api/prospects/bulk-upload to test automatic deduplication"
  });
}