import { Context, Markup } from 'telegraf';
import { pardes } from '../../services/pardes';
import { Author, Book } from '../../types';

const activeSearches = new Set<number>();

function formatAuthor(author: Author): string {
  const parts = [author.lastName, author.firstName, author.middleName].filter(Boolean);
  return parts.join(' ') || 'Неизвестный автор';
}

function formatAuthors(authors: Author[]): string {
  if (!authors || authors.length === 0) return 'Неизвестный автор';
  return authors.map(formatAuthor).join(', ');
}

function formatRating(rating?: number): string {
  if (!rating) return '';
  const stars = '★'.repeat(Math.round(rating));
  return ` ${stars} ${rating.toFixed(1)}`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatBook(book: Book): string {
  const title = escapeMarkdown(book.title);
  const authors = escapeMarkdown(formatAuthors(book.authors));
  const rating = formatRating(book.rating);
  const series = book.series
    ? `\n📚 ${escapeMarkdown(book.series)}${book.seriesNum ? ` \\#${book.seriesNum}` : ''}`
    : '';
  return `*${title}*\n${authors}${rating}${series}`;
}

export async function handleStart(ctx: Context): Promise<void> {
  await ctx.reply(
    'Короче. Пишешь название книги и я найду, окда.\n\n' +
    'Команды:\n' +
    '/random — случайные книги\n' +
    '/stats — статистика библиотеки'
  );
}

export async function handleStats(ctx: Context): Promise<void> {
  try {
    const stats = await pardes.getStats();
    await ctx.reply(
      `📚 Книг: ${stats.totalBooks.toLocaleString()}\n` +
      `✍️ Авторов: ${stats.totalAuthors.toLocaleString()}\n` +
      `🏷️ Жанров: ${stats.totalGenres.toLocaleString()}`
    );
  } catch (error) {
    console.error('Stats error:', error);
    await ctx.reply('Не могу достучаться до библиотеки, сорян');
  }
}

export async function handleRandom(ctx: Context): Promise<void> {
  try {
    const { books } = await pardes.getRandomBooks(5);
    if (!books || books.length === 0) {
      await ctx.reply('Пусто почему-то');
      return;
    }

    for (const book of books) {
      await ctx.replyWithMarkdownV2(
        formatBook(book),
        Markup.inlineKeyboard([
          Markup.button.callback('⬇️ Скачать', `dl_${book.id}`),
        ])
      );
    }
  } catch (error) {
    console.error('Random error:', error);
    await ctx.reply('Обосрался, сорре');
  }
}

export async function handleSearch(ctx: Context): Promise<void> {
  if (!ctx.message || !('text' in ctx.message)) return;

  const chatId = ctx.message.chat.id;
  const query = ctx.message.text;

  if (activeSearches.has(chatId)) {
    await ctx.reply('Погоди, я еще предыдущее ищу');
    return;
  }

  activeSearches.add(chatId);
  console.log(`[${chatId}] Search: "${query}"`);

  try {
    await ctx.reply('Ищем!');

    const result = await pardes.search(query, 10);

    if (!result.results || result.results.length === 0) {
      await ctx.reply('Не, нема. Попробуй как-то по другому ввести, хз');
      return;
    }

    await ctx.reply(`Нашлось ${result.total} книг, показываю первые ${result.results.length}:`);

    for (const book of result.results) {
      await ctx.replyWithMarkdownV2(
        formatBook(book),
        Markup.inlineKeyboard([
          Markup.button.callback('⬇️ Скачать', `dl_${book.id}`),
        ])
      );
    }

    await ctx.reply('Я всьо :3');
  } catch (error) {
    console.error('Search error:', error);
    await ctx.reply('Обосрался, сорре');
  } finally {
    activeSearches.delete(chatId);
  }
}

export async function handleDownload(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const data = ctx.callbackQuery.data;
  const bookId = parseInt(data.replace('dl_', ''), 10);

  if (isNaN(bookId)) {
    await ctx.answerCbQuery('Что-то пошло не так');
    return;
  }

  await ctx.answerCbQuery('Качаю...');

  try {
    const { buffer, filename } = await pardes.downloadBook(bookId);

    await ctx.replyWithDocument({
      source: buffer,
      filename,
    });
  } catch (error) {
    console.error('Download error:', error);
    await ctx.reply('Не смог скачать, сорян');
  }
}
