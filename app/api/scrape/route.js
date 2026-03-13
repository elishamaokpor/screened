import { NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'No username provided' }, { status: 400 });
  }

  try {
    // Step 1: fetch their public RSS feed
    const rssUrl = `https://letterboxd.com/${username}/rss/`;
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'User not found or profile is private' }, { status: 404 });
    }

    const xml = await res.text();

    // Step 2: parse all diary entries
    const items = xml.split('<item>').slice(1);

    if (items.length === 0) {
      return NextResponse.json({ error: 'No films found' }, { status: 404 });
    }

    const entries = [];

    for (const item of items) {
      const isDiary = item.includes('<letterboxd:watchedDate>');
      if (!isDiary) continue;

      const titleMatch = item.match(/<letterboxd:filmTitle>(.*?)<\/letterboxd:filmTitle>/);
      const title = titleMatch ? titleMatch[1] : null;
      if (!title) continue;

      const ratingMatch = item.match(/<letterboxd:memberRating>(.*?)<\/letterboxd:memberRating>/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

      const dateMatch = item.match(/<letterboxd:watchedDate>(.*?)<\/letterboxd:watchedDate>/);
      const watchedDate = dateMatch ? dateMatch[1] : null;

      entries.push({ title, rating, watchedDate });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No films logged yet' }, { status: 404 });
    }

    // Step 3: enrich with TMDB in batches to avoid rate limits
    const enriched = [];
    const batchSize = 5;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (entry) => {
        try {
          const searchRes = await fetch(
            `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(entry.title)}&page=1`,
            { headers: { Authorization: `Bearer ${TMDB_KEY}` } }
          );
          const searchData = await searchRes.json();
          const movie = searchData.results?.[0];
          if (!movie) return { ...entry, runtime: null, genres: [], director: null };

          const detailRes = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.id}?append_to_response=credits`,
            { headers: { Authorization: `Bearer ${TMDB_KEY}` } }
          );
          const detail = await detailRes.json();

          const director = detail.credits?.crew?.find(p => p.job === 'Director')?.name || null;
          const genres = detail.genres?.map(g => g.name) || [];
          const runtime = detail.runtime || null;

          return { ...entry, runtime, genres, director };
        } catch {
          return { ...entry, runtime: null, genres: [], director: null };
        }
      }));
      enriched.push(...results);
    }

    // Step 4: calculate stats
    const totalFilms = enriched.length;

    const totalMinutes = enriched.reduce((sum, f) => sum + (f.runtime || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalRuntime = `${hours}hrs ${mins}m`;

    // top director
    const directorCount = {};
    enriched.forEach(f => {
      if (f.director) directorCount[f.director] = (directorCount[f.director] || 0) + 1;
    });
    const topDirectorEntries = Object.entries(directorCount).sort((a, b) => b[1] - a[1]);
    const topDirector = topDirectorEntries[0]?.[0] || null;

    // top genre
    const genreCount = {};
    enriched.forEach(f => {
      f.genres.forEach(g => {
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
    });
    const topGenreEntries = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
    const topGenre = topGenreEntries[0]?.[0] || null;

    // top 5 highest rated
    const top5 = [...enriched]
      .filter(f => f.rating !== null)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5)
      .map(f => ({
        title: f.title,
        runtime: f.runtime ? `${Math.floor(f.runtime / 60)}hr ${f.runtime % 60}m` : '—',
        stars: starsFromRating(f.rating),
      }));

    // Step 5: personality algorithm
    const ratedFilms = enriched.filter(f => f.rating !== null);
    const avgRating = ratedFilms.length > 0
      ? ratedFilms.reduce((s, f) => s + f.rating, 0) / ratedFilms.length
      : 0;
    const avgRatingRounded = Math.round(avgRating * 10) / 10;

    const horrorCount = enriched.filter(f => f.genres.includes('Horror')).length;
    const romanceCount = enriched.filter(f => f.genres.includes('Romance')).length;
    const dramaCount = enriched.filter(f => f.genres.includes('Drama')).length;
    const lowRatings = ratedFilms.filter(f => f.rating < 3).length;
    const lowRatingRatio = ratedFilms.length > 0 ? lowRatings / ratedFilms.length : 0;

    let personality;

    if (totalFilms >= 30) {
      personality = 'The Completionist';
    } else if (totalFilms > 0 && horrorCount / totalFilms >= 0.35) {
      personality = 'The Horehead';
    } else if (lowRatingRatio >= 0.4 || avgRating < 2.8) {
      personality = 'The Contrarian';
    } else if (
      totalFilms > 0 &&
      (romanceCount + dramaCount) / totalFilms >= 0.5 &&
      avgRating >= 3.5
    ) {
      personality = 'The New Romantic';
    } else {
      personality = 'The Criterionist';
    }

    const grades = {
      'The Criterionist': 'A+',
      'The Completionist': 'B+',
      'The New Romantic': 'B-',
      'The Horehead': 'C+',
      'The Contrarian': 'F',
    };

    // Step 6: generate AI roast
    const roast = await generateRoast({
      personality,
      totalFilms,
      topDirector,
      topGenre,
      avgRating: avgRatingRounded,
      topFilm: top5[0]?.title || null,
    });

    return NextResponse.json({
      username,
      films: top5,
      totalFilms,
      totalRuntime,
      topDirector: topDirector || '—',
      topGenre: topGenre || '—',
      personality,
      grade: grades[personality],
      roast,
    });

  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong', detail: err.message }, { status: 500 });
  }
}

async function generateRoast({ personality, totalFilms, topDirector, topGenre, avgRating, topFilm }) {
  try {
    const directorLine = topDirector ? `Their most-watched director is ${topDirector}.` : '';
    const genreLine = topGenre ? `Their top genre is ${topGenre}.` : '';
    const filmLine = topFilm ? `Their highest rated film is "${topFilm}".` : '';

    const prompt = `Roast this Letterboxd user in exactly 1-2 sentences. Be witty, specific, and a little mean — like a friend who knows too much about your taste. Do not use quotation marks. No preamble, no sign-off, just the roast.

Their personality type: ${personality}
Total films logged: ${totalFilms}
Average rating: ${avgRating} out of 5
${directorLine}
${genreLine}
${filmLine}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const roast = data.content?.[0]?.text?.trim();
    return roast || fallbackRoast(personality);
  } catch {
    return fallbackRoast(personality);
  }
}

function fallbackRoast(personality) {
  const fallbacks = {
    'The Criterionist': 'Your watchlist is just a cry for help dressed in subtitles.',
    'The Completionist': "You've seen everything. Absorbed nothing.",
    'The New Romantic': 'You rate films based on how much they made you cry on public transport.',
    'The Horehead': 'You will watch anything as long as someone dies in it.',
    'The Contrarian': 'You gave that film 1 star because everyone else liked it. Brave.',
  };
  return fallbacks[personality] || 'Your taste is a work in progress.';
}

function starsFromRating(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? '½' : '';
  return '★'.repeat(full) + half;
}