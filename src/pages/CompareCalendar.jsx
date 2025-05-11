import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, Typography, Grid, Button, TextField, Box } from '@mui/material';

const localizer = momentLocalizer(moment);

export default function CompareCalendar({ myToken, invitedToken }) {
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState(null);
  const [timeMin, setTimeMin] = useState('');
  const [timeMax, setTimeMax] = useState('');
  const [meetingDuration, setMeetingDuration] = useState(60); // i minuter
  const [showAll, setShowAll] = useState(false); // Hanterar visning av alla tider

  const fetchAvailability = async () => {
    const token1 = myToken;
    const token2 = invitedToken || myToken; // Använd myToken om invitedToken saknas

    if (!token1 || !token2) {
      setError('Saknar en eller båda access tokens');
      return;
    }

    if (!timeMin || !timeMax) {
      setError('Ange ett datumintervall');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token1,
          token2,
          timeMin: new Date(timeMin).toISOString(),
          timeMax: new Date(timeMax).toISOString(),
          duration: meetingDuration, // Möteslängd i minuter
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAvailability(data);
        setError(null);
      } else {
        setError(data.error || 'Något gick fel vid hämtning av tillgänglighet');
      }
    } catch (err) {
      console.error('Fel vid API-anrop:', err);
      setError('Tekniskt fel vid hämtning av tillgänglighet');
    }
  };

  // Konvertera lediga tider till kalenderhändelser
  const events = availability.map((slot, index) => ({
    id: index,
    title: 'Ledig tid',
    start: new Date(slot.start),
    end: new Date(slot.end),
  }));

  // Begränsa antalet tider som visas
  const visibleAvailability = showAll ? availability : availability.slice(0, 4);

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Gemensam tillgänglighet
      </Typography>

      {/* Formulär */}
      <Box
        component="form"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          mb: 3,
          maxWidth: 400,
        }}
      >
        <TextField
          label="Från"
          type="datetime-local"
          InputLabelProps={{ shrink: true }}
          value={timeMin}
          onChange={(e) => setTimeMin(e.target.value)}
        />
        <TextField
          label="Till"
          type="datetime-local"
          InputLabelProps={{ shrink: true }}
          value={timeMax}
          onChange={(e) => setTimeMax(e.target.value)}
        />
        <TextField
          label="Mötestid (minuter)"
          type="number"
          value={meetingDuration}
          onChange={(e) => setMeetingDuration(Number(e.target.value))}
        />
        <Button variant="contained" color="primary" onClick={fetchAvailability}>
          Jämför
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}
      {!error && availability.length === 0 && <Typography>Inga lediga tider hittades.</Typography>}

      {/* Lista över lediga tider */}
      <Grid container spacing={2} sx={{ mt: 3 }}>
        {visibleAvailability.map((slot, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="textPrimary">
                  Start: {new Date(slot.start).toLocaleString()}
                </Typography>
                <Typography variant="body1" color="textPrimary">
                  Slut: {new Date(slot.end).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Visa fler-knapp */}
      {availability.length > 4 && (
        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowAll(!showAll)}
          sx={{ mt: 2 }}
        >
          {showAll ? 'Visa färre' : 'Visa alla'}
        </Button>
      )}

      {/* Kalenderkomponent */}
      <div style={{ height: 500, marginTop: '20px' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 500 }}
        />
      </div>
    </div>
  );
}
