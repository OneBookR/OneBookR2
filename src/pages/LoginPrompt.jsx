import React from 'react';

const LoginPrompt = () => {
  const handleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };

  return (
    <div>
      <h2>Vänligen logga in</h2>
      <button onClick={handleLogin}>Logga in med Google</button>
    </div>
  );
};

export default LoginPrompt;
