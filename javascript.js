// La Libertad Avanza - App Electoral Buenos Aires
// Sistema completo con autenticación, roles y funcionalidades

class ElectoralApp {
    constructor() {
        // API Configuration - CAMBIAR ESTA URL POR TU SERVIDOR
        this.API_BASE = 'http://localhost:8001/api'; // Cambiar por tu URL de producción
        
        // App State
        this.currentUser = null;
        this.currentPage = 'profile';
        this.isLogin = true;
        this.token = localStorage.getItem('electoral_token');
        
        // Data
        this.users = [];
        this.emergencyMessages = [];
        this.stats = {};
        
        // Camera
        this.stream = null;
        
        // Initialize app
        this.init();
    }

    async init() {
        console.log('🚀 Iniciando La Libertad Avanza Electoral App');
        
        // Check if user is logged in
        if (this.token) {
            await this.checkAuth();
        } else {
            this.showAuthScreen();
        }
        
        this.setupEventListeners();
    }

    // ==================== AUTHENTICATION ====================

    async checkAuth() {
        try {
            const response = await this.apiCall('GET', '/auth/me');
            this.currentUser = response;
            this.showMainApp();
            this.updateUserInterface();
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    async login(username, password) {
        try {
            const response = await this.apiCall('POST', '/auth/login', {
                username,
                password
            });

            this.token = response.access_token;
            this.currentUser = response.user;
            localStorage.setItem('electoral_token', this.token);
            
            this.showMainApp();
            this.updateUserInterface();
            return { success: true };
        } catch (error) {
            console.error('Login failed:', error);
            return { success: false, error: error.message || 'Error de login' };
        }
    }

    async register(userData) {
        try {
            const response = await this.apiCall('POST', '/auth/register', userData);

            this.token = response.access_token;
            this.currentUser = response.user;
            localStorage.setItem('electoral_token', this.token);
            
            this.showMainApp();
            this.updateUserInterface();
            return { success: true };
        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error: error.message || 'Error de registro' };
        }
    }

    async recoverPassword(email) {
        try {
            const response = await this.apiCall('POST', '/auth/password-recovery', { email });
            return { success: true, message: response.message };
        } catch (error) {
            console.error('Password recovery failed:', error);
            return { success: false, error: error.message || 'Error en recuperación' };
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('electoral_token');
        this.showAuthScreen();
    }

    // ==================== API CALLS ====================

    async apiCall(method, endpoint, data = null) {
        const url = `${this.API_BASE}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || `HTTP ${response.status}`);
        }

        return result;
    }

    async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('photo', file);
        
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        const response = await fetch(`${this.API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    // ==================== UI MANAGEMENT ====================

    showAuthScreen() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
        this.showPage('profile');
    }

    showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.add('hidden');
        });

        // Remove active class from nav items
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });

        // Show selected page
        document.getElementById(`${pageName}-page`).classList.remove('hidden');
        
        // Add active class to nav item (if exists)
        const navItem = document.querySelector(`.nav-item[onclick*="${pageName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        this.currentPage = pageName;

        // Load page-specific data
        switch (pageName) {
            case 'messages':
                this.loadEmergencyMessages();
                break;
            case 'admin':
                this.loadAdminData();
                break;
        }
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        // Update user info
        document.getElementById('user-display-name').textContent = 
            `${this.currentUser.first_name} ${this.currentUser.last_name}`;
        document.getElementById('user-username').textContent = `@${this.currentUser.username}`;
        document.getElementById('user-email').textContent = this.currentUser.email;

        // Update profile photo
        const avatar = document.getElementById('user-avatar');
        if (this.currentUser.profile_photo) {
            avatar.style.backgroundImage = `url(${this.currentUser.profile_photo})`;
            avatar.innerHTML = '';
        }

        // Show electoral section if available
        if (this.currentUser.electoral_section) {
            const sectionEl = document.getElementById('user-section');
            sectionEl.textContent = `Sección Electoral: ${this.currentUser.electoral_section}`;
            sectionEl.style.display = 'block';
        }

        // Update navigation based on role
        this.updateNavigation();

        // Hide user actions for non-users
        if (this.currentUser.role !== 'user') {
            document.getElementById('user-actions').style.display = 'none';
        }
    }

    updateNavigation() {
        const messagesNav = document.getElementById('nav-messages');
        const adminNav = document.getElementById('nav-admin');

        // Show/hide navigation items based on role
        if (this.currentUser.role === 'admin') {
            messagesNav.style.display = 'flex';
            adminNav.style.display = 'flex';
        } else if (this.currentUser.role === 'electoral_section') {
            messagesNav.style.display = 'flex';
            adminNav.style.display = 'none';
        } else {
            messagesNav.style.display = 'none';
            adminNav.style.display = 'none';
        }
    }

    // ==================== EVENT LISTENERS ====================

    setupEventListeners() {
        // Auth form
        document.getElementById('auth-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuthSubmit();
        });

        // Toggle between login/register
        document.getElementById('toggle-auth').addEventListener('click', () => {
            this.toggleAuthMode();
        });

        // Password recovery
        document.getElementById('show-recovery').addEventListener('click', () => {
            this.showPasswordRecovery();
        });

        document.getElementById('back-to-login').addEventListener('click', () => {
            this.showLogin();
        });

        document.getElementById('recovery-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordRecovery();
        });

        // Emergency form
        document.getElementById('emergency-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmergencySubmit();
        });

        // Electoral access form
        document.getElementById('electoral-access-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleElectoralAccess();
        });

        // Admin access form
        document.getElementById('admin-access-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAdminAccess();
        });

        // Hidden file input for camera
        document.getElementById('hidden-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handlePhotoUpload(e.target.files[0]);
            }
        });
    }

    // ==================== AUTH HANDLERS ====================

    async handleAuthSubmit() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = document.getElementById('auth-submit-btn');
        
        submitBtn.textContent = 'Cargando...';
        submitBtn.disabled = true;

        let result;
        if (this.isLogin) {
            result = await this.login(username, password);
        } else {
            const userData = {
                username,
                password,
                email: document.getElementById('email').value,
                first_name: document.getElementById('first_name').value,
                last_name: document.getElementById('last_name').value,
                phone: document.getElementById('phone').value
            };
            result = await this.register(userData);
        }

        if (result.success) {
            this.clearError();
        } else {
            this.showError(result.error);
        }

        submitBtn.textContent = this.isLogin ? 'Iniciar Sesión' : 'Registrarse';
        submitBtn.disabled = false;
    }

    toggleAuthMode() {
        this.isLogin = !this.isLogin;
        const registerFields = document.getElementById('register-fields');
        const title = document.getElementById('auth-title');
        const submitBtn = document.getElementById('auth-submit-btn');
        const toggleBtn = document.getElementById('toggle-auth');
        const recoveryContainer = document.getElementById('recovery-link-container');

        if (this.isLogin) {
            registerFields.classList.add('hidden');
            title.textContent = 'Iniciar Sesión';
            submitBtn.textContent = 'Iniciar Sesión';
            toggleBtn.textContent = '¿No tienes cuenta? Regístrate';
            recoveryContainer.style.display = 'block';
        } else {
            registerFields.classList.remove('hidden');
            title.textContent = 'Registrarse';
            submitBtn.textContent = 'Registrarse';
            toggleBtn.textContent = '¿Ya tienes cuenta? Inicia sesión';
            recoveryContainer.style.display = 'none';
        }

        this.clearError();
    }

    showPasswordRecovery() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('recovery-form').classList.remove('hidden');
    }

    showLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('recovery-form').classList.add('hidden');
    }

    async handlePasswordRecovery() {
        const email = document.getElementById('recovery-email').value;
        const result = await this.recoverPassword(email);
        
        if (result.success) {
            alert(result.message);
            this.showLogin();
        } else {
            alert(result.error);
        }
    }

    // ==================== ACCESS HANDLERS ====================

    async handleElectoralAccess() {
        const section = parseInt(document.getElementById('electoral-section').value);
        const code = document.getElementById('electoral-code').value;

        try {
            await this.apiCall('POST', '/auth/electoral-access', { section, code });
            alert('Acceso a sección electoral otorgado');
            await this.checkAuth(); // Refresh user data
        } catch (error) {
            alert('Código de sección incorrecto');
        }
    }

    async handleAdminAccess() {
        const code = document.getElementById('admin-code').value;

        try {
            await this.apiCall('POST', '/auth/admin-access', { code });
            alert('Acceso de administrador otorgado');
            await this.checkAuth(); // Refresh user data
        } catch (error) {
            alert('Código de administrador incorrecto');
        }
    }

    // ==================== EMERGENCY HANDLERS ====================

    async handleEmergencySubmit() {
        const message = document.getElementById('emergency-message').value;
        const photoFile = document.getElementById('emergency-photo').files[0];

        try {
            const data = { message };
            if (photoFile) {
                await this.uploadFile('/emergency/send', photoFile, data);
            } else {
                await this.apiCall('POST', '/emergency/send', data);
            }
            
            alert('Mensaje de emergencia enviado');
            document.getElementById('emergency-form').reset();
            this.showPage('profile');
        } catch (error) {
            alert('Error enviando mensaje de emergencia');
        }
    }

    async loadEmergencyMessages() {
        try {
            const messages = await this.apiCall('GET', '/emergency/messages');
            this.emergencyMessages = messages;
            this.renderEmergencyMessages();
        } catch (error) {
            console.error('Error loading emergency messages:', error);
        }
    }

    renderEmergencyMessages() {
        const container = document.getElementById('messages-list');
        container.innerHTML = '';

        this.emergencyMessages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = 'report-item';
            
            const canDelete = this.currentUser.role === 'admin' || msg.user_id === this.currentUser.id;
            
            msgEl.innerHTML = `
                <div class="report-header">
                    <span class="report-type">Emergencia</span>
                    <span class="report-date">
                        ${new Date(msg.timestamp).toLocaleDateString('es-AR')}
                    </span>
                    ${canDelete ? `
                        <button class="delete-btn-small" onclick="app.deleteEmergencyMessage('${msg.id}')">
                            ×
                        </button>
                    ` : ''}
                </div>
                <div class="report-content">
                    <p><strong>${msg.user_name}</strong></p>
                    <p>${msg.message}</p>
                    ${msg.photo ? `
                        <div class="photo-container">
                            <img src="${msg.photo}" class="report-photo" alt="Emergencia" 
                                 onclick="window.open('${msg.photo}', '_blank')" style="cursor: pointer;">
                            <button class="print-photo-btn" onclick="app.printPhoto('${msg.photo}')">
                                🖨️ Imprimir
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(msgEl);
        });
    }

    async deleteEmergencyMessage(messageId) {
        if (confirm('¿Estás seguro de eliminar este mensaje?')) {
            try {
                await this.apiCall('DELETE', `/emergency/${messageId}`);
                alert('Mensaje eliminado');
                this.loadEmergencyMessages();
            } catch (error) {
                alert('Error eliminando mensaje');
            }
        }
    }

    // ==================== ADMIN HANDLERS ====================

    async loadAdminData() {
        if (this.currentUser.role !== 'admin') return;

        try {
            // Load stats
            this.stats = await this.apiCall('GET', '/admin/stats');
            this.updateAdminStats();

            // Load users
            await this.loadUsers();

            // Load emergency messages for admin view
            await this.loadEmergencyMessages();
            this.renderAdminEmergencyMessages();
        } catch (error) {
            console.error('Error loading admin data:', error);
        }
    }

    updateAdminStats() {
        document.getElementById('total-users').textContent = this.stats.total_users || 0;
        document.getElementById('pending-emergencies').textContent = this.stats.pending_emergencies || 0;
        document.getElementById('total-reports').textContent = this.stats.total_reports || 0;

        // Update sections grid
        const sectionsGrid = document.getElementById('sections-grid');
        sectionsGrid.innerHTML = '';

        if (this.stats.section_stats) {
            this.stats.section_stats.forEach(section => {
                const sectionEl = document.createElement('div');
                sectionEl.className = 'section-stat-card';
                sectionEl.innerHTML = `
                    <h4>Sección ${section.section}</h4>
                    <p>${section.users} usuarios</p>
                `;
                sectionsGrid.appendChild(sectionEl);
            });
        }
    }

    async loadUsers() {
        try {
            this.users = await this.apiCall('GET', '/admin/users');
            this.renderUsers();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    renderUsers() {
        const container = document.getElementById('users-list');
        container.innerHTML = '';

        this.users.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'admin-list-item';
            
            userEl.innerHTML = `
                <div class="user-info">
                    <div class="user-name">${user.first_name} ${user.last_name}</div>
                    <div class="user-description">
                        @${user.username} • ${user.email}
                        ${user.electoral_section ? ` • Sección ${user.electoral_section}` : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="app.deleteUser('${user.id}')">
                    Eliminar
                </button>
            `;
            
            container.appendChild(userEl);
        });
    }

    async deleteUser(userId) {
        if (confirm('¿Estás seguro de eliminar este usuario?')) {
            try {
                await this.apiCall('DELETE', `/admin/users/${userId}`);
                alert('Usuario eliminado');
                this.loadUsers();
            } catch (error) {
                alert('Error eliminando usuario');
            }
        }
    }

    renderAdminEmergencyMessages() {
        const container = document.getElementById('admin-messages-list');
        container.innerHTML = '';

        this.emergencyMessages.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = 'report-item';
            
            msgEl.innerHTML = `
                <div class="report-header">
                    <span class="report-type">Emergencia</span>
                    <span class="report-date">
                        ${new Date(msg.timestamp).toLocaleDateString('es-AR')}
                    </span>
                    <button class="delete-btn-small" onclick="app.deleteEmergencyMessage('${msg.id}')">
                        ×
                    </button>
                </div>
                <div class="report-content">
                    <p><strong>${msg.user_name}</strong></p>
                    <p>${msg.message}</p>
                    ${msg.photo ? `
                        <div class="photo-container">
                            <img src="${msg.photo}" class="report-photo" alt="Emergencia" 
                                 onclick="window.open('${msg.photo}', '_blank')" style="cursor: pointer;">
                            <button class="print-photo-btn" onclick="app.printPhoto('${msg.photo}')">
                                🖨️ Imprimir
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(msgEl);
        });
    }

    async exportToPDF() {
        try {
            const response = await fetch(`${this.API_BASE}/export/reports-pdf`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Error exporting PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `reportes_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Error exportando PDF');
        }
    }

    // ==================== PHOTO HANDLERS ====================

    async handlePhotoUpload(file) {
        try {
            await this.uploadFile('/users/upload-photo', file);
            alert('Foto de perfil actualizada correctamente');
            await this.checkAuth(); // Refresh user data
        } catch (error) {
            alert('Error subiendo foto de perfil');
        }
    }

    openCamera() {
        document.getElementById('hidden-file-input').click();
    }

    printPhoto(photoUrl) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head><title>Imprimir Foto</title></head>
                <body style="margin: 0; text-align: center;">
                    <img src="${photoUrl}" style="max-width: 100%; height: auto;">
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    // ==================== UTILITY FUNCTIONS ====================

    showError(message) {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    clearError() {
        const errorEl = document.getElementById('error-message');
        errorEl.classList.add('hidden');
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ==================== GLOBAL FUNCTIONS ====================

let app;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app = new ElectoralApp();
});

// Global functions for HTML onclick handlers
function showPage(pageName) {
    app.showPage(pageName);
}

function showProfile() {
    app.showPage('profile');
}

function showEmergencyForm() {
    app.showPage('emergency');
}

function openCamera() {
    app.openCamera();
}

function logout() {
    app.logout();
}

function loadUsers() {
    app.loadUsers();
}

function exportToPDF() {
    app.exportToPDF();
}

// ==================== PWA FUNCTIONS ====================

// Install PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install banner
    console.log('PWA install prompt ready');
});

window.installPWA = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
    }
};

// ==================== ELECTORAL SECTION CODES ====================

const ELECTORAL_SECTIONS = {
    1: "Rob2024",
    2: "Elec2025", 
    3: "Rolon2025",
    4: "Hitche123",
    5: "Sil2021",
    6: "Lla2025",
    7: "Lla2027",
    8: "Mil2025",
    9: "Libertad2025"
};

const ADMIN_CODE = "David2025";

console.log('🎯 La Libertad Avanza Electoral App - LISTA PARA PRODUCCIÓN');
console.log('📱 PWA Completa | 🔐 Sistema de Autenticación | 👑 Panel Admin');
console.log('🗳️ ¡VIVA LA LIBERTAD! 🗳️');