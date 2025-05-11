import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';

export default function InviteFriend({ fromUser, fromToken }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const sendInvite = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, fromUser, fromToken }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Inbjudan skickad!');
        setEmail('');
      } else {
        setMessage(data.error || 'Något gick fel.');
      }
    } catch (err) {
      console.error('Fel vid utskick:', err);
      setMessage('Tekniskt fel.');
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Bjud in en vän
      </Typography>
      <TextField
        label="Väns e-postadress"
        variant="outlined"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Button variant="contained" color="primary" onClick={sendInvite}>
        Skicka inbjudan
      </Button>
      {message && (
        <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}

function App() {
  const user = {
    displayName: 'John Doe',
    accessToken: 'abc123',
  };

  return (
    <InviteFriend fromUser={user.displayName} fromToken={user.accessToken} />
  );
}
