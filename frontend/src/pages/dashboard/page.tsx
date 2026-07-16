'use client';

import { useEffect, useState } from 'react';
import { findingsAPI, complianceAPI, approvalsAPI } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [complianceStatus, setComplianceStatus] = useState<any>(null);
  const [pendingDeployments, setPendingDeployments] = useState<any[]>([]);
  const [mttr, setMttr] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, complianceData, deploymentsData, mttrData] = await Promise.all([
        findingsAPI.getStats(),
        complianceAPI.getStatus(),
        approvalsAPI.getPending(),
        findingsAPI.getMTTR(),
      ]);
      setStats(statsData);
      setComplianceStatus(complianceData);
      setPendingDeployments(deploymentsData);
      setMttr(mttrData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  if (!stats || !complianceStatus) {
    return <div className="p-8">Loading...</div>;
  }

  const severityData = stats.bySeverity?.map((item: any) => ({
    name: item.severity,
    count: item._count,
  })) || [];

  const statusData = stats.byStatus?.map((item: any) => ({
    name: item.status,
    count: item._count,
  })) || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Security Compliance Dashboard</h1>
        <div className="text-sm text-gray-600">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="text-sm text-gray-600">Total Findings</div>
          <div className="text-3xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Compliance Score</div>
          <div className="text-3xl font-bold text-green-600">
            {complianceStatus.compliantControls}/{complianceStatus.totalControls}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">MTTR</div>
          <div className="text-3xl font-bold">
            {mttr?.mttrHours?.toFixed(1) || 0}h
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Pending Deployments</div>
          <div className="text-3xl font-bold">{pendingDeployments.length}</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Findings by Severity</h2>
          <BarChart width={500} height={300} data={severityData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Findings by Status</h2>
          <PieChart width={500} height={300}>
            <Pie
              data={statusData}
              cx={250}
              cy={150}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
              label
            >
              {statusData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </Card>
      </div>

      {/* Pending Deployments */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Approvals</h2>
        {pendingDeployments.length === 0 ? (
          <div className="text-gray-500">No pending deployments</div>
        ) : (
          <div className="space-y-4">
            {pendingDeployments.map((deployment) => (
              <div key={deployment.id} className="border p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{deployment.service}</div>
                    <div className="text-sm text-gray-600">
                      {deployment.environment} • {deployment.version}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {deployment.criticalCount} Critical • {deployment.highCount} High
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(deployment.requestedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
