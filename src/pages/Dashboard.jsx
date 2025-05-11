import React from 'react';
import InviteFriend from './InviteFriend';
import CompareCalendar from './CompareCalendar';
import { Container, Typography, Box } from '@mui/material';

export default function Dashboard({ user }) {
  const urlParams = new URLSearchParams(window.location.search);
  const invitedToken = urlParams.get('token'); // Om användaren kom via inbjudningslänk

  return (
    <Container maxWidth="md" sx={{ mt: 5 }}>
      <Typography variant="h5" gutterBottom>
        Hej {user.displayName}
      </Typography>
      <Box sx={{ mb: 4 }}>
        <InviteFriend fromUser={user.displayName} fromToken={user.accessToken} />
      </Box>
      <CompareCalendar myToken={user.accessToken} invitedToken={invitedToken} />
    </Container>
  );
}
