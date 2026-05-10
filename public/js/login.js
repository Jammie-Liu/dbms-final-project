async function login() {

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    try {
        const res = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            // token 存進 localStorage，之後每個頁面都會用到
            localStorage.setItem('token', data.token);
            localStorage.setItem('userID', data.userID);
            localStorage.setItem('username', data.username);
            localStorage.setItem('role', data.role);



            // 根據是否設定過偏好決定跳去哪
            if (!data.hasPreferences) {
                window.location.href = 'preferences.html';
            } else {
                window.location.href = 'index.html';
            }
        } else {
            message.textContent = data.message;
            message.style.color = 'red';
        }
    } catch (err) {
        message.textContent = '伺服器錯誤，請稍後再試';
        message.style.color = 'red';
    }
}