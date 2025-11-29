'use client';

import React from 'react';
import { FileText, Clock, Settings, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AuditTrail: React.FC = () => {
  return (
    <div>
      <div className="w-full">
        {/* Coming Soon Content */}
        <div className="flex items-center justify-center min-h-[500px]">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
                  <FileText className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl">Audit Trail Coming Soon</CardTitle>
              <CardDescription className="text-center">
                We're building a comprehensive audit trail system to help you maintain security, compliance, and transparency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Real-time Activity Tracking</h3>
                    <p className="text-sm text-muted-foreground">
                      Monitor user actions and system events as they happen across your entire workspace.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Compliance Reporting</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate detailed reports for regulatory compliance and internal audits.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Detailed Activity Logs</h3>
                    <p className="text-sm text-muted-foreground">
                      Access comprehensive logs with advanced filtering, search, and export capabilities.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm">
                  <strong className="text-primary">Note:</strong> This feature is currently in development and will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
