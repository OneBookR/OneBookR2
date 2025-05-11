import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import { Container, Typography, Button, Box } from '@mui/material';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/user', {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(err => {
        console.error('Kunde inte hämta användardata:', err);
      });
  }, []);

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h4" gutterBottom>
          Välkommen till BookR
        </Typography>
        <Button
          variant="contained"
          color="primary"
          href="http://localhost:3000/auth/google"
        >
          Logga in med Google
        </Button>
      </Container>
    );
  }

  return <Dashboard user={user} />;
}

export default App;
