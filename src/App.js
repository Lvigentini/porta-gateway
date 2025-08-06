import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { AuthService } from './services/AuthService';
import { handleAuth } from './api/auth';
function App() {
    const [status, setStatus] = useState('Loading...');
    const [lastTest, setLastTest] = useState('');
    useEffect(() => {
        checkHealth();
        // Set up API route handlers for development
        setupAPIRoutes();
    }, []);
    const checkHealth = async () => {
        try {
            const health = await AuthService.getHealth();
            setStatus(health.status);
            setLastTest(health.timestamp);
        }
        catch (error) {
            setStatus('Error checking health');
        }
    };
    const setupAPIRoutes = () => {
        // In production, Vercel will handle routing
        // This is for development testing
        if (import.meta.env.DEV) {
            console.log('Porta Gateway API endpoints available:');
            console.log('- POST /api/auth/login');
            console.log('- GET /api/health');
        }
    };
    const testLogin = async () => {
        console.log('BUTTON CLICKED - testLogin function called');
        try {
            console.log('🔥 Starting test login...');
            const credentials = {
                email: 'admin@arca.dev',
                password: 'admin123',
                app: 'arca',
                redirect_url: 'https://arca-alpha.vercel.app'
            };
            console.log('📤 Sending credentials:', credentials);
            // Check if we're running locally or in production
            const isLocal = import.meta.env.DEV;
            console.log('🔥 Running locally:', isLocal);
            let response;
            if (isLocal) {
                // LOCAL: Use client-side auth handler
                console.log('🚀 Making local auth request...');
                const testRequest = new Request('http://localhost/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });
                response = await handleAuth(testRequest);
            }
            else {
                // PRODUCTION: Call actual Vercel function
                console.log('🚀 Making production API request to /api/auth/login...');
                response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });
            }
            console.log('📨 Response status:', response.status);
            console.log('📨 Response headers:', Object.fromEntries(response.headers.entries()));
            const result = await response.json();
            console.log('📦 Full response body:', result);
            if (response.status >= 400) {
                console.error('🚨 API Error Response:', result);
            }
            if (result.success && result.token) {
                console.log('✅ Login successful!');
                alert('Test login successful! Token: ' + result.token.substring(0, 20) + '...');
            }
            else {
                console.log('❌ Login failed:', result.error || 'Unknown error');
                alert('Test login failed: ' + (result.error || 'Unknown error'));
            }
        }
        catch (error) {
            console.error('💥 Test login error:', error);
            console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack');
            alert('Test error: ' + error);
        }
    };
    const testSupabaseDirect = async () => {
        try {
            console.log('🧪 Testing Supabase direct connection...');
            const supabaseUrl = import.meta.env.VITE_CLIENT_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_CLIENT_SUPABASE_ANON_KEY;
            console.log('🧪 Environment variables:', {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseKey,
                url: supabaseUrl
            });
            // Test 1: Direct Supabase auth
            console.log('🧪 Step 1: Testing Supabase auth API...');
            const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'admin@arca.dev',
                    password: 'admin123'
                })
            });
            const authResult = await authResponse.json();
            console.log('🧪 Auth API result:', {
                status: authResponse.status,
                hasAccessToken: !!authResult.access_token,
                hasUser: !!authResult.user,
                userId: authResult.user?.id
            });
            if (!authResult.access_token) {
                alert('❌ Supabase auth failed: ' + JSON.stringify(authResult));
                return;
            }
            // Test 2: User profile lookup
            console.log('🧪 Step 2: Testing user profile lookup...');
            const profileResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authResult.user.id}`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${authResult.access_token}`
                }
            });
            const profileResult = await profileResponse.json();
            console.log('🧪 Profile API result:', {
                status: profileResponse.status,
                userCount: Array.isArray(profileResult) ? profileResult.length : 0,
                user: profileResult[0]
            });
            if (profileResult.length > 0) {
                alert('✅ Supabase direct test successful!\nUser: ' + profileResult[0].email + '\nRole: ' + profileResult[0].role);
            }
            else {
                alert('❌ User profile not found');
            }
        }
        catch (error) {
            console.error('🧪 Supabase direct test error:', error);
            alert('❌ Direct test error: ' + error);
        }
    };
    const testProductionHealth = async () => {
        try {
            console.log('🏥 Testing production health endpoint...');
            const response = await fetch('/api/health');
            const result = await response.json();
            console.log('🏥 Health response:', result);
            if (response.ok) {
                alert('✅ Production health check successful!\nStatus: ' + result.status);
            }
            else {
                alert('❌ Production health check failed: ' + result.error);
            }
        }
        catch (error) {
            console.error('🏥 Health check error:', error);
            alert('❌ Health check error: ' + error);
        }
    };
    const testSimpleEndpoint = async () => {
        try {
            console.log('🧪 Testing simple API endpoint...');
            const response = await fetch('/api/test-simple');
            const result = await response.json();
            console.log('🧪 Simple API response:', result);
            if (response.ok) {
                alert('✅ Simple API works!\nEnvironment variables found: ' + result.environment.envVars.join(', '));
            }
            else {
                alert('❌ Simple API failed: ' + result.error);
            }
        }
        catch (error) {
            console.error('🧪 Simple API error:', error);
            alert('❌ Simple API error: ' + error);
        }
    };
    return (_jsxs("div", { style: {
            padding: '2rem',
            fontFamily: 'system-ui',
            maxWidth: '800px',
            margin: '0 auto'
        }, children: [_jsx("h1", { style: { color: '#2563eb', marginBottom: '2rem' }, children: "\uD83D\uDEAA Porta Gateway" }), _jsxs("div", { style: {
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    marginBottom: '2rem'
                }, children: [_jsx("h2", { children: "System Status" }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { style: {
                                    color: status.includes('healthy') ? '#16a34a' : '#dc2626'
                                }, children: status })] }), _jsxs("p", { children: [_jsx("strong", { children: "Last Check:" }), " ", lastTest] }), _jsxs("div", { style: { marginTop: '1rem' }, children: [_jsx("button", { onClick: checkHealth, style: {
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '1rem'
                                }, children: "Refresh Status" }), _jsx("button", { onClick: testLogin, style: {
                                    background: '#16a34a',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '1rem'
                                }, children: "Test Login (Client)" }), _jsx("button", { onClick: testSupabaseDirect, style: {
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "Test Supabase Direct" }), _jsx("button", { onClick: testProductionHealth, style: {
                                    background: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginLeft: '1rem'
                                }, children: "Test Prod Health" }), _jsx("button", { onClick: testSimpleEndpoint, style: {
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginLeft: '1rem'
                                }, children: "Test Simple API" })] })] }), _jsxs("div", { style: {
                    background: '#fefce8',
                    border: '1px solid #eab308',
                    borderRadius: '8px',
                    padding: '1.5rem'
                }, children: [_jsx("h3", { children: "\uD83D\uDD17 API Endpoints" }), _jsxs("ul", { style: { margin: '1rem 0' }, children: [_jsxs("li", { children: [_jsx("code", { children: "POST /api/auth/login" }), " - Authenticate users"] }), _jsxs("li", { children: [_jsx("code", { children: "GET /api/health" }), " - Health check"] })] }), _jsx("h3", { children: "\uD83C\uDFAF Usage" }), _jsx("p", { children: "ARCA should POST to:" }), _jsx("code", { style: {
                            background: '#1f2937',
                            color: '#f9fafb',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            display: 'block',
                            marginTop: '0.5rem'
                        }, children: "https://porta-gateway.vercel.app/api/auth/login" })] })] }));
}
export default App;
