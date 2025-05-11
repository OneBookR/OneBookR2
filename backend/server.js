import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json());
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth-strategi
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken;
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Routes
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly']
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('http://localhost:5173')
);

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user, token: req.user.accessToken });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

const fetchCalendarEvents = async (token, min, max) => {
  try {
    // Hämta alla kalendrar
    const calendarListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const calendarListData = await calendarListResponse.json();
    if (!calendarListResponse.ok) {
      console.error('API-fel vid hämtning av kalenderlista:', calendarListData.error);
      return [];
    }

    const calendars = calendarListData.items || [];

    // Hämta händelser från varje kalender
    const eventsPromises = calendars.map(async (calendar) => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendar.id
          )}/events?timeMin=${min}&timeMax=${max}&singleEvents=true&orderBy=startTime`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();
        if (!response.ok) {
          console.error(`API-fel för kalender ${calendar.id}:`, data.error);
          return []; // Ignorera denna kalender
        }

        return data.items || [];
      } catch (err) {
        console.error(`Fel vid hämtning av händelser för kalender ${calendar.id}:`, err);
        return []; // Ignorera denna kalender
      }
    });

    // Vänta på alla händelser
    const allEvents = await Promise.all(eventsPromises);

    console.log('Hämtade händelser:', allEvents);

    // Slå ihop alla händelser till en enda array
    return allEvents.flat();
  } catch (err) {
    console.error('Fel vid hämtning av kalenderhändelser:', err);
    return [];
  }
};

app.post('/api/availability', async (req, res) => {
  const { token1, token2, timeMin, timeMax, duration } = req.body;

  if (!token1 || !token2) {
    return res.status(400).json({ error: 'Båda tokens krävs' });
  }

  if (!timeMin || !timeMax) {
    return res.status(400).json({ error: 'timeMin och timeMax krävs' });
  }

  try {
    const [events1, events2] = await Promise.all([
      fetchCalendarEvents(token1, timeMin, timeMax),
      fetchCalendarEvents(token2, timeMin, timeMax),
    ]);

    // Skapa en lista över upptagna tider för båda användarna
    const busyTimes1 = events1.map(e => ({
      start: new Date(e.start.dateTime || e.start.date).getTime(),
      end: new Date(e.end.dateTime || e.end.date).getTime(),
    }));

    const busyTimes2 = events2.map(e => ({
      start: new Date(e.start.dateTime || e.start.date).getTime(),
      end: new Date(e.end.dateTime || e.end.date).getTime(),
    }));

    console.log('Upptagna tider användare 1:', busyTimes1);
    console.log('Upptagna tider användare 2:', busyTimes2);

    // Slå samman upptagna tider för varje användare
    const mergeBusyTimes = (busyTimes) => {
      busyTimes.sort((a, b) => a.start - b.start);
      const merged = [];
      for (const time of busyTimes) {
        if (!merged.length || time.start > merged[merged.length - 1].end) {
          merged.push(time);
        } else {
          merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, time.end);
        }
      }
      return merged;
    };

    const mergedBusy1 = mergeBusyTimes(busyTimes1);
    const mergedBusy2 = mergeBusyTimes(busyTimes2);

    console.log('Sammanfogade upptagna tider användare 1:', mergedBusy1);
    console.log('Sammanfogade upptagna tider användare 2:', mergedBusy2);

    if (mergedBusy1.length === 0 && mergedBusy2.length === 0) {
      return res.json([{ start: new Date(timeMin), end: new Date(timeMax) }]);
    }

    // Beräkna lediga tider för varje användare
    const calculateFreeTimes = (mergedBusy, rangeStart, rangeEnd) => {
      const freeTimes = [];
      let cursor = rangeStart;

      for (const slot of mergedBusy) {
        if (cursor < slot.start) {
          freeTimes.push({ start: new Date(cursor), end: new Date(slot.start) });
        }
        cursor = Math.max(cursor, slot.end);
      }

      if (cursor < rangeEnd) {
        freeTimes.push({ start: new Date(cursor), end: new Date(rangeEnd) });
      }

      return freeTimes;
    };

    const rangeStart = new Date(timeMin).getTime();
    const rangeEnd = new Date(timeMax).getTime();

    const freeTimes1 = calculateFreeTimes(mergedBusy1, rangeStart, rangeEnd);
    const freeTimes2 = calculateFreeTimes(mergedBusy2, rangeStart, rangeEnd);

    console.log('Lediga tider användare 1:', freeTimes1);
    console.log('Lediga tider användare 2:', freeTimes2);

    // Hitta gemensamma lediga tider
    const findCommonFreeTimes = (freeTimes1, freeTimes2) => {
      const commonFreeTimes = [];
      let i = 0, j = 0;

      while (i < freeTimes1.length && j < freeTimes2.length) {
        const start = Math.max(freeTimes1[i].start.getTime(), freeTimes2[j].start.getTime());
        const end = Math.min(freeTimes1[i].end.getTime(), freeTimes2[j].end.getTime());

        if (start < end) {
          commonFreeTimes.push({ start: new Date(start), end: new Date(end) });
        }

        if (freeTimes1[i].end.getTime() < freeTimes2[j].end.getTime()) {
          i++;
        } else {
          j++;
        }
      }

      return commonFreeTimes;
    };

    const commonFreeTimes = findCommonFreeTimes(freeTimes1, freeTimes2);

    // Filtrera gemensamma lediga tider baserat på möteslängd
    const filteredCommonFreeTimes = commonFreeTimes.filter(slot => {
      return (slot.end.getTime() - slot.start.getTime()) >= duration * 60 * 1000;
    });

    console.log('Gemensamma lediga tider:', filteredCommonFreeTimes);

    res.json(filteredCommonFreeTimes);
  } catch (err) {
    console.error('Error fetching availability:', err.message, err.stack);
    res.status(500).json({ error: 'Kunde inte hämta tillgänglighet' });
  }
});

app.post('/api/invite', async (req, res) => {
  const { email, fromUser, fromToken } = req.body;

  if (!email || !fromUser || !fromToken) {
    return res.status(400).json({ error: 'Alla fält krävs (email, fromUser, fromToken)' });
  }

  try {
    const inviteLink = `http://localhost:5173?token=${fromToken}`;
    console.log(`Skickar inbjudan till ${email} med länk: ${inviteLink}`);

    // Konfigurera nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Använd Gmail eller annan e-posttjänst
      auth: {
        user: process.env.EMAIL_USER, // Din e-postadress
        pass: process.env.EMAIL_PASS, // Ditt e-postlösenord eller app-lösenord
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Inbjudan till Kalenderjämförelse',
      text: `Hej ${email},\n\n${fromUser} har bjudit in dig att jämföra kalendrar. Klicka på länken nedan för att acceptera inbjudan:\n\n${inviteLink}\n\nHälsningar,\nKalenderjämförelse-teamet`,
    };

    // Skicka mejlet
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Inbjudan skickad!' });
  } catch (err) {
    console.error('Fel vid utskick av inbjudan:', err);
    res.status(500).json({ error: 'Kunde inte skicka inbjudan' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});