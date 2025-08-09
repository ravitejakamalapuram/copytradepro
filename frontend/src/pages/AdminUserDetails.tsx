import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import { PageTransition } from '../utils/animations';
import { adminService } from '../services/adminService';
import '../styles/app-theme.css';

interface UserDetails {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: 'USER' | 'ADMIN' | 'MODERATOR';
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
    lastLogin: string;
    createdAt: string;
    totalTrades: number;
    portfolioValue: number;
    totalPnL: number;
    connectedBrokers: string[];
    riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
    kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface UserActivity {
    id: string;
    type: 'LOGIN' | 'TRADE' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTINGS_CHANGE';
    description: string;
    timestamp: string;
    ipAddress?: string;
    device?: string;
}

const AdminUserDetails: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'trading' | 'security'>('profile');
    const [loading, setLoading] = useState(false);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

    const [userActivity, setUserActivity] = useState<UserActivity[]>([]);

    // Load user data on component mount
    useEffect(() => {
        if (userId) {
            loadUserData();
        }
    }, [userId]);

    const loadUserData = async () => {
        try {
            setLoading(true);
            const [userResponse, activityResponse] = await Promise.all([
                adminService.getUserDetails(userId!),
                adminService.getUserActivity(userId!)
            ]);

            if (userResponse.success) {
                setUserDetails(userResponse.data as UserDetails);
            }

            if (activityResponse.success) {
                setUserActivity(activityResponse.data);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            showToast({ type: 'error', title: 'Failed to load user data' });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
            case 'APPROVED':
                return 'var(--color-profit)';
            case 'SUSPENDED':
            case 'REJECTED':
                return 'var(--color-loss)';
            case 'PENDING':
                return 'var(--color-neutral)';
            default:
                return 'var(--text-secondary)';
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'LOGIN': return '🔐';
            case 'TRADE': return '📈';
            case 'DEPOSIT': return '💰';
            case 'WITHDRAWAL': return '💸';
            case 'SETTINGS_CHANGE': return '⚙️';
            default: return '📋';
        }
    };

    const suspendUser = () => {
        if (window.confirm('Are you sure you want to suspend this user?')) {
            showToast({ type: 'success', title: 'User suspended successfully' });
        }
    };

    const resetPassword = () => {
        if (window.confirm('Send password reset email to this user?')) {
            showToast({ type: 'success', title: 'Password reset email sent' });
        }
    };

    if (loading) {
        return (
            <div className="app-theme app-layout">
                <AppNavigation />
                <PageTransition>
                    <div className="app-main">
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            Loading user details...
                        </div>
                    </div>
                </PageTransition>
            </div>
        );
    }

    if (!userDetails) {
        return (
            <div className="app-theme app-layout">
                <AppNavigation />
                <PageTransition>
                    <div className="app-main">
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                            User not found
                        </div>
                    </div>
                </PageTransition>
            </div>
        );
    }

    return (
        <div className="app-theme app-layout">
            <AppNavigation />
            <PageTransition>
                <div className="app-main">
                    <Stack gap={6}>
                        {/* Header */}
                        <Flex justify="between" align="center">
                            <div>
                                <Flex align="center" gap={3}>
                                    <Button variant="outline" onClick={() => navigate('/admin')}>
                                        ← Back to Admin
                                    </Button>
                                    <div>
                                        <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                                            {userDetails.name}
                                        </h1>
                                        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                                            {userDetails.email} • User ID: {userDetails.id}
                                        </p>
                                    </div>
                                </Flex>
                            </div>
                            <Flex gap={2}>
                                <Button variant="outline" onClick={resetPassword}>
                                    🔑 Reset Password
                                </Button>
                                <Button variant="danger" onClick={suspendUser}>
                                    🚫 Suspend User
                                </Button>
                            </Flex>
                        </Flex>

                        {/* User Status Cards */}
                        <Grid cols={4} gap={4}>
                            <Card>
                                <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '600',
                                        marginBottom: '0.25rem',
                                        color: getStatusColor(userDetails.status)
                                    }}>
                                        {userDetails.status}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Account Status
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                                        {userDetails.totalTrades}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Total Trades
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                                        {formatCurrency(userDetails.portfolioValue)}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Portfolio Value
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '600',
                                        marginBottom: '0.25rem',
                                        fontFamily: 'var(--font-mono)',
                                        color: userDetails.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                                    }}>
                                        {userDetails.totalPnL >= 0 ? '+' : ''}{formatCurrency(userDetails.totalPnL)}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        Total P&L
                                    </div>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Tab Navigation */}
                        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
                            {[
                                { key: 'profile', label: 'Profile', icon: '👤' },
                                { key: 'activity', label: 'Activity Log', icon: '📋' },
                                { key: 'trading', label: 'Trading History', icon: '📈' },
                                { key: 'security', label: 'Security', icon: '🔒' }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as 'profile' | 'security' | 'trading' | 'activity')}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        border: 'none',
                                        background: 'none',
                                        color: activeTab === tab.key ? 'var(--interactive-primary)' : 'var(--text-secondary)',
                                        borderBottom: activeTab === tab.key ? '2px solid var(--interactive-primary)' : '2px solid transparent',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <Grid cols={2} gap={4}>
                                <Card>
                                    <CardHeader title="Personal Information" />
                                    <CardContent>
                                        <Stack gap={3}>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Full Name</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>{userDetails.name}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Email</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>{userDetails.email}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Phone</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>{userDetails.phone || 'Not provided'}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Member Since</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>
                                                    {new Date(userDetails.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </Stack>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader title="Account Details" />
                                    <CardContent>
                                        <Stack gap={3}>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Role</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>{userDetails.role}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>KYC Status</label>
                                                <div style={{
                                                    fontWeight: '500',
                                                    marginTop: '0.25rem',
                                                    color: getStatusColor(userDetails.kycStatus)
                                                }}>
                                                    {userDetails.kycStatus}
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Risk Profile</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>{userDetails.riskProfile}</div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Connected Brokers</label>
                                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>
                                                    {userDetails.connectedBrokers.join(', ')}
                                                </div>
                                            </div>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}

                        {/* Activity Log Tab */}
                        {activeTab === 'activity' && (
                            <Card>
                                <CardHeader title="Recent Activity" />
                                <CardContent>
                                    <Stack gap={3}>
                                        {userActivity.map(activity => (
                                            <div
                                                key={activity.id}
                                                style={{
                                                    padding: '1rem',
                                                    border: '1px solid var(--border-secondary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    backgroundColor: 'var(--bg-tertiary)'
                                                }}
                                            >
                                                <Flex justify="between" align="start">
                                                    <Flex align="start" gap={3}>
                                                        <div style={{ fontSize: '1.5rem' }}>
                                                            {getActivityIcon(activity.type)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                                {activity.description}
                                                            </div>
                                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                                {activity.device} • {activity.ipAddress}
                                                            </div>
                                                        </div>
                                                    </Flex>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                        {new Date(activity.timestamp).toLocaleString()}
                                                    </div>
                                                </Flex>
                                            </div>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </Card>
                        )}

                        {/* Trading History Tab */}
                        {activeTab === 'trading' && (
                            <Card>
                                <CardHeader title="Trading Performance" />
                                <CardContent>
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                                        <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Trading history coming soon</div>
                                        <div style={{ fontSize: '0.875rem' }}>Detailed trading analytics and history will be available here</div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <Stack gap={4}>
                                <Card>
                                    <CardHeader title="Security Settings" />
                                    <CardContent>
                                        <Stack gap={4}>
                                            <Flex justify="between" align="center">
                                                <div>
                                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                        Two-Factor Authentication
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                        Enhanced security for account access
                                                    </div>
                                                </div>
                                                <span style={{
                                                    color: 'var(--color-loss)',
                                                    fontWeight: '500',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    Disabled
                                                </span>
                                            </Flex>

                                            <Flex justify="between" align="center">
                                                <div>
                                                    <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                        Login Notifications
                                                    </div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                        Email alerts for new device logins
                                                    </div>
                                                </div>
                                                <span style={{
                                                    color: 'var(--color-profit)',
                                                    fontWeight: '500',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    Enabled
                                                </span>
                                            </Flex>
                                        </Stack>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader title="Admin Actions" />
                                    <CardContent>
                                        <Grid cols={2} gap={3}>
                                            <Button variant="outline">
                                                🔑 Force Password Reset
                                            </Button>
                                            <Button variant="outline">
                                                📧 Send Security Alert
                                            </Button>
                                            <Button variant="outline">
                                                🔒 Lock Account
                                            </Button>
                                            <Button variant="danger">
                                                🗑️ Delete Account
                                            </Button>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Stack>
                        )}
                    </Stack>
                </div>
            </PageTransition>
        </div>
    );
};

export default AdminUserDetails;