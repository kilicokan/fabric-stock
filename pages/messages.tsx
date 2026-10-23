import React, { useState, useEffect, useRef } from 'react';
import {
    TextField,
    Button,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Badge,
    InputAdornment,
    CircularProgress,
    Divider,
    Paper,
    Modal,
    Box,
    Menu,
    MenuItem,
    Snackbar,
    Alert
} from '@mui/material';
import { Send, Search, MessageCircle, ArrowLeft, Bell, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import AuthGuard from '../components/AuthGuard';

interface Message {
    id: number;
    senderId: number;
    recipientId: number;
    content: string;
    isRead: boolean;
    createdAt: string;
    sender: {
        id: number;
        name?: string;
        email: string;
    };
    recipient: {
        id: number;
        name?: string;
        email: string;
    };
}

interface Conversation {
    partnerId: number;
    partnerName: string;
    partnerEmail: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
}

interface User {
    id: number;
    email: string;
    name?: string;
}

type ConversationApiItem = {
    userId?: number;
    id?: number;
    partnerId?: number;
    userName?: string;
    partnerName?: string;
    userEmail?: string;
    partnerEmail?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    lastMessageTime?: string;
    unreadCount?: number;
};

type ApiErrorLike = {
    response?: {
        status?: number;
    };
};

const isUnauthorized = (error: unknown): boolean => {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as ApiErrorLike;
    return candidate.response?.status === 401;
};

const MessagesPage: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; type: 'message' | 'conversation'; id: number } | null>(null);
    const [lastMessageCount, setLastMessageCount] = useState(0);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastSender, setToastSender] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = JSON.parse(atob(token.split('.')[1]));
                setCurrentUser(decoded);
            } catch (e) {
                console.error('Failed to decode token');
            }
        }

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
                console.log('📬 Notification permission:', permission);
            });
        }

        fetchConversations();
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation);
            // Poll for new messages every 2 seconds
            pollingInterval.current = setInterval(() => {
                fetchMessages(selectedConversation);
            }, 2000);
        }
        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
        };
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const showNotification = (title: string, options?: NotificationOptions) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                icon: '/miraapp-logo.jpg',
                ...options
            });

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

            // Click to focus window
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    };

    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ No token found in localStorage');
                return;
            }

            const response = await axios.get('/api/messages/conversations', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Handle both old and new API formats
            const convData = response.data.data || response.data.conversations || response.data;
            const conversations = Array.isArray(convData) ? convData : [];

            // Transform API response to UI format
            const transformedConversations = conversations.map((conv: ConversationApiItem) => ({
                partnerId: conv.userId || conv.id || conv.partnerId,
                partnerName: conv.userName || conv.partnerName || 'Unknown',
                partnerEmail: conv.userEmail || conv.partnerEmail || '',
                lastMessage: conv.lastMessage || '',
                lastMessageTime: conv.lastMessageAt || conv.lastMessageTime || '',
                unreadCount: conv.unreadCount || 0
            }));

            setConversations(transformedConversations);
        } catch (error: unknown) {
            console.error('❌ Error fetching conversations:', error);
            if (isUnauthorized(error)) {
                console.error('Token invalid or expired. Clearing localStorage...');
                localStorage.removeItem('token');
            }
        }
    };

    const fetchAllUsers = async () => {
        setLoadingUsers(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ No token found in localStorage');
                setLoadingUsers(false);
                return;
            }

            const response = await axios.get('/api/users', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            let users = Array.isArray(response.data) ? response.data : response.data.users || [];
            // Filter out current user
            if (currentUser?.id) {
                users = users.filter((u: User) => u.id !== currentUser.id);
            }
            setAllUsers(users as User[]);
        } catch (error: unknown) {
            console.error('❌ Error fetching users:', error);
            if (isUnauthorized(error)) {
                console.error('Token invalid or expired');
                localStorage.removeItem('token');
            }
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleStartConversation = (userId: number) => {
        setSelectedConversation(userId);
        setShowNewMessageModal(false);
        fetchMessages(userId);
    };

    const fetchMessages = async (partnerId: number) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ No token found in localStorage');
                setLoading(false);
                return;
            }

            const response = await axios.get(`/api/messages?conversationWith=${partnerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const msgs = response.data.data || response.data.messages || [];

            // Check for new messages and show notification
            const receivedMessages = msgs.filter((msg: Message) => !msg.isRead && currentUser?.id && msg.recipientId === currentUser.id);
            if (receivedMessages.length > lastMessageCount && receivedMessages.length > 0) {
                const senderName = conversations.find(c => c.partnerId === partnerId)?.partnerName || 'Birisinden';
                const lastMsg = receivedMessages[receivedMessages.length - 1];

                // Desktop notification
                showNotification(`📨 ${senderName} mesaj gönderdi`, {
                    body: lastMsg.content.substring(0, 100),
                    tag: `message-${partnerId}`,
                    badge: '/miraapp-logo.jpg'
                });

                // Toast notification in-app
                setToastSender(senderName);
                setToastMessage(lastMsg.content.substring(0, 80));
                setToastOpen(true);
            }
            setLastMessageCount(receivedMessages.length);
            setMessages(msgs);

            // Mark unread messages as read
            const unreadIds = receivedMessages.map((msg: Message) => msg.id);

            if (unreadIds.length > 0) {
                await axios.patch(
                    '/api/messages/mark-read',
                    { messageIds: unreadIds },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }
        } catch (error: unknown) {
            console.error('❌ Error fetching messages:', error);
            if (isUnauthorized(error)) {
                console.error('Token invalid or expired');
                localStorage.removeItem('token');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedConversation) return;

        const messageText = messageInput;
        setMessageInput('');

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ No token found in localStorage');
                setMessageInput(messageText);
                return;
            }

            console.log('Sending message:', { recipientId: selectedConversation, content: messageText });

            const response = await axios.post(
                '/api/messages',
                { recipientId: selectedConversation, content: messageText },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Message sent successfully:', response.data);

            // Mesajları yenile
            await fetchMessages(selectedConversation);
            // Konuşmaları yenile
            await fetchConversations();
        } catch (error: unknown) {
            console.error('❌ Error sending message:', error);
            setMessageInput(messageText); // Hata olursa mesajı geri yazı
            if (isUnauthorized(error)) {
                console.error('Token invalid or expired');
                localStorage.removeItem('token');
            }
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        if (!window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Token bulunamadı. Lütfen tekrar giriş yapınız.');
                return;
            }

            await axios.delete(`/api/messages/delete?messageId=${messageId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Refresh messages
            if (selectedConversation) {
                await fetchMessages(selectedConversation);
            }
            setContextMenu(null);
        } catch (error: unknown) {
            console.error('❌ Error deleting message:', error);
            if (isUnauthorized(error)) {
                localStorage.removeItem('token');
                alert('Token expired. Lütfen tekrar giriş yapınız.');
            } else {
                alert('Mesaj silinirken hata oluştu');
            }
        }
    };

    const handleDeleteConversation = async (partnerId: number) => {
        if (!window.confirm('Bu konuşmayı tamamen silmek istediğinize emin misiniz?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Token bulunamadı. Lütfen tekrar giriş yapınız.');
                return;
            }

            await axios.delete(`/api/messages/delete?conversationWith=${partnerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Refresh conversations
            await fetchConversations();
            setSelectedConversation(null);
            setMessages([]);
            setContextMenu(null);
        } catch (error: unknown) {
            console.error('❌ Error deleting conversation:', error);
            if (isUnauthorized(error)) {
                localStorage.removeItem('token');
                alert('Token expired. Lütfen tekrar giriş yapınız.');
            } else {
                alert('Konuşma silinirken hata oluştu');
            }
        }
    };

    const selectedConv = conversations.find(c => c.partnerId === selectedConversation);
    const filteredConversations = conversations.filter(c =>
        c.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.partnerEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AuthGuard>
            <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F3F4F6' }}>
                {/* Conversations Sidebar */}
                <div style={{
                    width: selectedConversation ? 0 : '360px',
                    backgroundColor: 'white',
                    borderRight: '1px solid #E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.3s ease',
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid #E5E7EB',
                        backgroundColor: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <MessageCircle size={24} style={{ color: 'white' }} />
                            <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                                Mesajlar
                            </h2>
                            <Button
                                variant="text"
                                onClick={() => {
                                    setShowNewMessageModal(true);
                                    fetchAllUsers();
                                }}
                                style={{
                                    marginLeft: 'auto',
                                    minWidth: 'auto',
                                    padding: '6px',
                                    color: 'white'
                                }}
                            >
                                <Plus size={20} />
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ padding: '12px 16px' }}>
                        <TextField
                            placeholder="Kişi veya email ara..."
                            size="small"
                            fullWidth
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>
                            }}
                        />
                    </div>

                    {/* Conversations List */}
                    <List style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredConversations.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B7280' }}>
                                <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                                <p>Henüz hiç mesaj yok</p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <ListItemButton
                                    key={conv.partnerId}
                                    selected={selectedConversation === conv.partnerId}
                                    onClick={() => setSelectedConversation(conv.partnerId)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({
                                            mouseX: e.clientX - 2,
                                            mouseY: e.clientY - 4,
                                            type: 'conversation',
                                            id: conv.partnerId
                                        });
                                    }}
                                    style={{
                                        backgroundColor: selectedConversation === conv.partnerId ? '#F3F4F6' : 'transparent',
                                        borderBottom: '1px solid #F3F4F6'
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: selectedConversation === conv.partnerId ? 'bold' : 'normal' }}>
                                                    {conv.partnerName}
                                                </span>
                                                {conv.unreadCount > 0 && (
                                                    <Badge badgeContent={conv.unreadCount} color="error" style={{ marginLeft: '8px' }} />
                                                )}
                                            </div>
                                        }
                                        secondary={
                                            <span style={{
                                                fontSize: '12px',
                                                color: '#6B7280',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {conv.lastMessage}
                                            </span>
                                        }
                                    />
                                </ListItemButton>
                            ))
                        )}
                    </List>
                </div>

                {/* Messages View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {selectedConversation && selectedConv ? (
                        <>
                            {/* Chat Header */}
                            <div style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #E5E7EB',
                                backgroundColor: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Button
                                        variant="text"
                                        onClick={() => {
                                            setSelectedConversation(null);
                                            setMessages([]);
                                        }}
                                        style={{ minWidth: 'auto', padding: '8px' }}
                                    >
                                        <ArrowLeft size={20} />
                                    </Button>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                                            {selectedConv.partnerName}
                                        </h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                                            {selectedConv.partnerEmail}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '16px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                {loading && messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px' }}>
                                        <CircularProgress />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        color: '#6B7280',
                                        padding: '24px',
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <div>
                                            <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                                            <p>Henüz hiç mesaj yok</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: msg.senderId === currentUser?.id ? 'flex-end' : 'flex-start',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <Paper
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextMenu({
                                                        mouseX: e.clientX - 2,
                                                        mouseY: e.clientY - 4,
                                                        type: 'message',
                                                        id: msg.id
                                                    });
                                                }}
                                                style={{
                                                    padding: '12px 16px',
                                                    maxWidth: '70%',
                                                    backgroundColor: msg.senderId === currentUser?.id ? '#8B5CF6' : '#F3F4F6',
                                                    color: msg.senderId === currentUser?.id ? 'white' : '#1F2937',
                                                    cursor: 'context-menu'
                                                }}
                                            >
                                                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                                                    {msg.content}
                                                </p>
                                                <span style={{
                                                    fontSize: '11px',
                                                    opacity: 0.7
                                                }}>
                                                    {new Date(msg.createdAt).toLocaleDateString('tr-TR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })} {new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </Paper>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid #E5E7EB',
                                backgroundColor: 'white',
                                display: 'flex',
                                gap: '8px'
                            }}>
                                <TextField
                                    fullWidth
                                    placeholder="Mesaj yazın..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    multiline
                                    maxRows={3}
                                    size="small"
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim()}
                                    style={{
                                        backgroundColor: '#8B5CF6',
                                        color: 'white',
                                        padding: '10px 20px'
                                    }}
                                >
                                    <Send size={18} />
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6B7280',
                            flexDirection: 'column'
                        }}>
                            <MessageCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <p style={{ fontSize: '16px', margin: 0 }}>Sohbet başlamak için kişi seçin</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New Message Modal */}
            <Modal open={showNewMessageModal} onClose={() => setShowNewMessageModal(false)}>
                <Box
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '70vh',
                        overflow: 'auto'
                    }}
                >
                    <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB' }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold' }}>
                            Yeni Mesaj Başlat
                        </h2>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                            Kişi seçip mesaj gönderebilirsiniz
                        </p>
                    </div>

                    {loadingUsers ? (
                        <div style={{ padding: '24px', textAlign: 'center' }}>
                            <CircularProgress />
                        </div>
                    ) : (
                        <List style={{ padding: 0 }}>
                            {allUsers.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                                    <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                                    <p>Kullanıcı bulunamadı</p>
                                </div>
                            ) : (
                                allUsers.map((user) => (
                                    <ListItemButton
                                        key={user.id}
                                        onClick={() => handleStartConversation(user.id)}
                                        style={{
                                            borderBottom: '1px solid #F3F4F6',
                                            padding: '12px 16px'
                                        }}
                                    >
                                        <ListItemText
                                            primary={user.name || user.email}
                                            secondary={user.email}
                                        />
                                    </ListItemButton>
                                ))
                            )}
                        </List>
                    )}
                </Box>
            </Modal>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={() => setContextMenu(null)}
                anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
                anchorReference="anchorPosition"
            >
                {contextMenu?.type === 'message' && (
                    <MenuItem
                        onClick={() => handleDeleteMessage(contextMenu.id)}
                        style={{ color: '#EF4444' }}
                    >
                        <Trash2 size={18} style={{ marginRight: '8px' }} />
                        Mesajı Sil
                    </MenuItem>
                )}
                {contextMenu?.type === 'conversation' && (
                    <MenuItem
                        onClick={() => handleDeleteConversation(contextMenu.id)}
                        style={{ color: '#EF4444' }}
                    >
                        <Trash2 size={18} style={{ marginRight: '8px' }} />
                        Konuşmayı Sil
                    </MenuItem>
                )}
            </Menu>

            {/* Toast Notification */}
            <Snackbar
                open={toastOpen}
                autoHideDuration={6000}
                onClose={() => setToastOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setToastOpen(false)}
                    severity="success"
                    variant="filled"
                    style={{
                        backgroundColor: '#8B5CF6',
                        color: 'white',
                        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.5)',
                        minWidth: '350px'
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '15px' }}>
                        📨 {toastSender}
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.95, lineHeight: '1.4' }}>
                        {toastMessage}
                    </div>
                </Alert>
            </Snackbar>
        </AuthGuard>
    );
};

export default MessagesPage;
