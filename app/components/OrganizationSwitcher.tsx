'use client';

import { OrganizationSwitcher as ClerkOrgSwitcher } from '@clerk/nextjs';

export function OrganizationSwitcher() {
  return (
    <ClerkOrgSwitcher
      appearance={{
        elements: {
          rootBox: "flex",
          organizationSwitcherTrigger: [
            "bg-gray-700 text-white hover:bg-gray-600",
            "px-3 py-2 rounded-lg text-sm font-medium",
            "border border-gray-600"
          ].join(" "),
          organizationSwitcherPopoverCard: "bg-gray-800 border-gray-700",
          organizationSwitcherPopoverActionButton: "text-gray-300 hover:text-white hover:bg-gray-700",
          organizationPreviewAvatarBox: "border-gray-600",
        }
      }}
      createOrganizationMode="modal"
      afterCreateOrganizationUrl="/"
      afterLeaveOrganizationUrl="/"
      afterSelectOrganizationUrl="/"
      hidePersonal={false}
      organizationProfileMode="modal"
    />
  );
}