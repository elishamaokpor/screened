import { NextResponse } from 'next/server';

const TMDB_KEY = process.env.TMDB_API_KEY;

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

    // Step 2: parse all diary entries (no month filter — all time)
    const items = xml.split('<item>').slice(1);

    if (items.length === 0) {
      return NextResponse.json({ error: 'No films found' }, { status: 404 });
    }

    const entries = [];

    for (const item of items) {
      // only include diary entries (watched films), not lists or reviews
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

    // Step 3: enrich with TMDB (runtime, genre, director)
    const enriched = await Promise.all(entries.map(async (entry) => {
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
    const topDirector = Object.entries(directorCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // top genre
    const genreCount = {};
    enriched.forEach(f => {
      f.genres.forEach(g => {
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

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
    const avgRating = ratedFilms.reduce((s, f) => s + f.rating, 0) / (ratedFilms.length || 1);

    const horrorCount = enriched.filter(f => f.genres.includes('Horror')).length;
    const romanceCount = enriched.filter(f => f.genres.includes('Romance')).length;
    const dramaCount = enriched.filter(f => f.genres.includes('Drama')).length;
    const thrillerCount = enriched.filter(f => f.genres.includes('Thriller')).length;
    const actionCount = enriched.filter(f => f.genres.includes('Action')).length;

    // how many films rated below 3 stars
    const lowRatings = ratedFilms.filter(f => f.rating < 3).length;
    const lowRatingRatio = lowRatings / (ratedFilms.length || 1);

    let personality;

    if (totalFilms >= 30) {
      // watches a lot = Completionist
      personality = 'The Completionist';
    } else if (horrorCount / totalFilms >= 0.35) {
      // mostly horror = Horehead
      personality = 'The Horehead';
    } else if (lowRatingRatio >= 0.4 || avgRating < 2.8) {
      // rates most things poorly = Contrarian
      personality = 'The Contrarian';
    } else if (
      (romanceCount + dramaCount) / totalFilms >= 0.5 &&
      avgRating >= 3.5
    ) {
      // lots of romance/drama + rates generously = New Romantic
      personality = 'The New Romantic';
    } else {
      // high avg rating + varied or prestige genres = Criterionist
      personality = 'The Criterionist';
    }

    const grades = {
      'The Criterionist': 'A+',
      'The Completionist': 'B+',
      'The New Romantic': 'B-',
      'The Horehead': 'C+',
      'The Contrarian': 'F',
    };

    return NextResponse.json({
      username,
      films: top5,
      totalFilms,
      totalRuntime,
      topDirector,
      topGenre,
      personality,
      grade: grades[personality],
    });

  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong', detail: err.message }, { status: 500 });
  }
}

function starsFromRating(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? '½' : '';
  return '★'.repeat(full) + half;
}