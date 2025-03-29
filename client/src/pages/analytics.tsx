import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Mission, MissionResult } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Menu, BarChart } from "lucide-react";
import { AreaChart, Area, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Chart color palette
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Analytics() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('monthly');
  
  // Fetch missions
  const { data: missions, isLoading: missionsLoading } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
  });
  
  // Prepare chart data
  
  // Mission by status
  const missionsByStatus = [
    { name: 'Planned', value: missions?.filter(m => m.status === 'planned').length || 0 },
    { name: 'Active', value: missions?.filter(m => m.status === 'active').length || 0 },
    { name: 'Completed', value: missions?.filter(m => m.status === 'completed').length || 0 },
    { name: 'Cancelled', value: missions?.filter(m => m.status === 'cancelled').length || 0 },
  ].filter(item => item.value > 0);
  
  // Mock data for demonstration purposes (in a real app, this would be from API)
  const missionsTrendData = [
    { name: 'Jan', missions: 4 },
    { name: 'Feb', missions: 6 },
    { name: 'Mar', missions: 8 },
    { name: 'Apr', missions: 5 },
    { name: 'May', missions: 12 },
    { name: 'Jun', missions: 9 },
  ];
  
  const batteryUsageData = [
    { name: 'Agricultural Survey', batteryUsed: 35 },
    { name: 'Construction Site', batteryUsed: 42 },
    { name: 'Wildlife Monitoring', batteryUsed: 28 },
    { name: 'Urban Planning', batteryUsed: 50 },
  ];
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile sidebar toggle */}
      <Sidebar className={sidebarOpen ? "block absolute z-20 h-screen" : "hidden"} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-4 text-gray-600"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-xl font-semibold text-gray-800">Analytics</h1>
            </div>
            
            <div className="flex items-center">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Last Week</SelectItem>
                  <SelectItem value="monthly">Last Month</SelectItem>
                  <SelectItem value="quarterly">Last Quarter</SelectItem>
                  <SelectItem value="yearly">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Total Missions</p>
                  <h3 className="text-3xl font-bold text-gray-800">{missions?.length || 0}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Completed</p>
                  <h3 className="text-3xl font-bold text-green-600">
                    {missions?.filter(m => m.status === 'completed').length || 0}
                  </h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Success Rate</p>
                  <h3 className="text-3xl font-bold text-blue-600">
                    {missions && missions.length > 0 
                      ? `${Math.round((missions.filter(m => m.status === 'completed').length / missions.length) * 100)}%`
                      : '0%'
                    }
                  </h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Avg. Duration</p>
                  <h3 className="text-3xl font-bold text-amber-600">48m</h3>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Mission Status Distribution</CardTitle>
                <CardDescription>Current status of all missions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={missionsByStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {missionsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Mission Trends</CardTitle>
                <CardDescription>Number of missions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={missionsTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="missions" stroke="#3B82F6" fill="#93C5FD" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Battery Usage by Mission</CardTitle>
              <CardDescription>Average battery percentage used per mission</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={batteryUsageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="batteryUsed" fill="#10B981" name="Battery Used (%)" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
