async function register() {

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    if (!username || !email || !password) {
        message.textContent = 'Please fill in all fields';
        message.style.color = 'red';
        return;
    }

    try {
        const res = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await res.json();

        if (res.ok) {
            message.textContent = '註冊成功！跳轉到登入頁面...';
            message.style.color = 'green';
            setTimeout(() => window.location.href = 'login.html', 1500);
        } else {
            message.textContent = data.message;
            message.style.color = 'red';
        }
    } catch (err) {
        message.textContent = '伺服器錯誤，請稍後再試';
        message.style.color = 'red';
    }
}