import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

// PARDES color scheme - mystical library vibes
class PardesColors {
  static const Color primary = Color(0xFF8B5CF6); // Purple
  static const Color secondary = Color(0xFFD946EF); // Magenta
  static const Color background = Color(0xFF0F0F1A); // Deep dark
  static const Color surface = Color(0xFF1A1A2E); // Card background
  static const Color surfaceLight = Color(0xFF252542); // Lighter surface
  static const Color accent = Color(0xFFF59E0B); // Gold/amber for ratings
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
}

// Genre code to Russian name mapping
const Map<String, String> genreNames = {
  'sf': 'Научная фантастика',
  'sf_fantasy': 'Фэнтези',
  'sf_action': 'Боевая фантастика',
  'sf_space': 'Космическая фантастика',
  'sf_heroic': 'Героическая фантастика',
  'sf_cyberpunk': 'Киберпанк',
  'sf_detective': 'Детективная фантастика',
  'sf_horror': 'Ужасы и мистика',
  'sf_humor': 'Юмористическая фантастика',
  'sf_social': 'Социальная фантастика',
  'sf_postapocalyptic': 'Постапокалипсис',
  'sf_etc': 'Фантастика: прочее',
  'sf_history': 'Альтернативная история',
  'detective': 'Детектив',
  'det_classic': 'Классический детектив',
  'det_police': 'Полицейский детектив',
  'det_action': 'Боевик',
  'det_irony': 'Иронический детектив',
  'det_history': 'Исторический детектив',
  'det_espionage': 'Шпионский детектив',
  'det_crime': 'Криминальный детектив',
  'det_political': 'Политический детектив',
  'det_maniac': 'Маньяки',
  'det_hard': 'Крутой детектив',
  'thriller': 'Триллер',
  'prose_classic': 'Классическая проза',
  'prose_contemporary': 'Современная проза',
  'prose_rus_classic': 'Русская классика',
  'prose_su_classics': 'Советская классика',
  'prose_history': 'Историческая проза',
  'prose_military': 'О войне',
  'prose_counter': 'Контркультура',
  'love': 'Любовные романы',
  'love_history': 'Исторические любовные романы',
  'love_contemporary': 'Современные любовные романы',
  'love_detective': 'Остросюжетные любовные романы',
  'love_short': 'Короткие любовные романы',
  'love_sf': 'Любовное фэнтези',
  'love_erotica': 'Эротика',
  'adventure': 'Приключения',
  'adv_western': 'Вестерн',
  'adv_history': 'Исторические приключения',
  'adv_indian': 'Приключения про индейцев',
  'adv_maritime': 'Морские приключения',
  'adv_geo': 'Путешествия и география',
  'adv_animal': 'Природа и животные',
  'children': 'Детская литература',
  'child_tale': 'Сказки',
  'child_verse': 'Детские стихи',
  'child_prose': 'Детская проза',
  'child_sf': 'Детская фантастика',
  'child_det': 'Детские детективы',
  'child_adv': 'Детские приключения',
  'child_education': 'Детская образовательная',
  'poetry': 'Поэзия',
  'dramaturgy': 'Драматургия',
  'antique': 'Старинная литература',
  'antique_ant': 'Античная литература',
  'antique_european': 'Европейская старинная',
  'antique_russian': 'Древнерусская литература',
  'antique_east': 'Древневосточная литература',
  'antique_myths': 'Мифы и легенды',
  'sci_history': 'История',
  'sci_psychology': 'Психология',
  'sci_culture': 'Культурология',
  'sci_religion': 'Религиоведение',
  'sci_philosophy': 'Философия',
  'sci_politics': 'Политика',
  'sci_business': 'Деловая литература',
  'sci_juris': 'Юриспруденция',
  'sci_linguistic': 'Языкознание',
  'sci_medicine': 'Медицина',
  'sci_phys': 'Физика',
  'sci_math': 'Математика',
  'sci_chem': 'Химия',
  'sci_biology': 'Биология',
  'sci_tech': 'Технические науки',
  'sci_geo': 'Геология и география',
  'computers': 'Компьютеры',
  'comp_www': 'Интернет',
  'comp_programming': 'Программирование',
  'comp_hard': 'Железо',
  'comp_soft': 'Программы',
  'comp_db': 'Базы данных',
  'comp_osnet': 'ОС и сети',
  'reference': 'Справочники',
  'ref_encyc': 'Энциклопедии',
  'ref_dict': 'Словари',
  'ref_ref': 'Справочники',
  'ref_guide': 'Путеводители',
  'nonf_biography': 'Биографии и мемуары',
  'nonf_publicism': 'Публицистика',
  'nonf_criticism': 'Критика',
  'nonf_military': 'Военная документалистика',
  'design': 'Искусство и дизайн',
  'religion': 'Религия',
  'religion_rel': 'Религия',
  'religion_esoterics': 'Эзотерика',
  'religion_self': 'Самосовершенствование',
  'humor': 'Юмор',
  'humor_anecdote': 'Анекдоты',
  'humor_prose': 'Юмористическая проза',
  'humor_verse': 'Юмористические стихи',
  'home': 'Дом и семья',
  'home_cooking': 'Кулинария',
  'home_pets': 'Домашние животные',
  'home_crafts': 'Хобби и ремёсла',
  'home_entertain': 'Развлечения',
  'home_health': 'Здоровье',
  'home_garden': 'Сад и огород',
  'home_diy': 'Сделай сам',
  'home_sport': 'Спорт',
  'home_sex': 'Эротика и секс',
};

String getGenreDisplayName(String code) {
  final cleanCode = code.replaceAll(':', '');
  return genreNames[cleanCode] ?? cleanCode;
}

void main() {
  runApp(const PardesApp());
}

class PardesApp extends StatelessWidget {
  const PardesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PARDES',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: PardesColors.primary,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: PardesColors.background,
        appBarTheme: const AppBarTheme(
          backgroundColor: PardesColors.background,
          elevation: 0,
          centerTitle: false,
        ),
        cardTheme: CardThemeData(
          color: PardesColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: PardesColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: PardesColors.primary, width: 2),
          ),
          hintStyle: const TextStyle(color: PardesColors.textSecondary),
        ),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

// API Service
class PardesApi {
  static String baseUrl = 'http://localhost:3000';

  static Future<Map<String, dynamic>> getStats() async {
    final response = await http.get(Uri.parse('$baseUrl/stats'));
    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getRandomBooks({int count = 10, String? genre}) async {
    var url = '$baseUrl/books/random?count=$count';
    if (genre != null) url += '&genre=$genre';
    final response = await http.get(Uri.parse(url));
    final data = jsonDecode(response.body);
    return data['books'] ?? [];
  }

  static Future<List<dynamic>> getTopBooks({int limit = 20}) async {
    final response = await http.get(Uri.parse('$baseUrl/books/top?limit=$limit'));
    final data = jsonDecode(response.body);
    return data['books'] ?? [];
  }

  static Future<Map<String, dynamic>> searchBooks(String query, {int limit = 20, int offset = 0}) async {
    final response = await http.get(Uri.parse('$baseUrl/books?q=${Uri.encodeComponent(query)}&limit=$limit&offset=$offset'));
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getBook(int id) async {
    final response = await http.get(Uri.parse('$baseUrl/books/$id'));
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getBookContent(int id) async {
    final response = await http.get(Uri.parse('$baseUrl/books/$id/read'));
    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getGenres() async {
    final response = await http.get(Uri.parse('$baseUrl/genres'));
    final data = jsonDecode(response.body);
    return data['genres'] ?? [];
  }

  static Future<List<dynamic>> getSeries({int limit = 50}) async {
    final response = await http.get(Uri.parse('$baseUrl/series?limit=$limit'));
    final data = jsonDecode(response.body);
    return data['series'] ?? [];
  }

  static Future<Map<String, dynamic>> getSeriesBooks(String name) async {
    final response = await http.get(Uri.parse('$baseUrl/series/${Uri.encodeComponent(name)}'));
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getGenreBooks(String genre) async {
    final response = await http.get(Uri.parse('$baseUrl/genres/${Uri.encodeComponent(genre)}'));
    return jsonDecode(response.body);
  }

  static String getDownloadUrl(int id) => '$baseUrl/books/$id/download';
}

// Home Screen with sidebar navigation (macOS style)
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  Map<String, dynamic>? _stats;
  bool _loading = true;

  final List<NavigationItem> _navItems = [
    NavigationItem(icon: Icons.explore, label: 'Discover'),
    NavigationItem(icon: Icons.search, label: 'Search'),
    NavigationItem(icon: Icons.category, label: 'Genres'),
    NavigationItem(icon: Icons.collections_bookmark, label: 'Series'),
    NavigationItem(icon: Icons.star, label: 'Top Rated'),
  ];

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await PardesApi.getStats();
      setState(() {
        _stats = stats;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          // Sidebar
          Container(
            width: 220,
            color: PardesColors.surface,
            child: Column(
              children: [
                // App Header
                Container(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [PardesColors.primary, PardesColors.secondary],
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.menu_book, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'PARDES',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: PardesColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),

                // Stats
                if (_stats != null)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: PardesColors.surfaceLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        _StatRow(icon: Icons.book, label: 'Books', value: '${_stats!['totalBooks']}'),
                        const SizedBox(height: 8),
                        _StatRow(icon: Icons.person, label: 'Authors', value: '${_stats!['totalAuthors']}'),
                        const SizedBox(height: 8),
                        _StatRow(icon: Icons.label, label: 'Genres', value: '${_stats!['totalGenres']}'),
                      ],
                    ),
                  ),

                const SizedBox(height: 20),

                // Navigation
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: _navItems.length,
                    itemBuilder: (context, index) {
                      final item = _navItems[index];
                      final selected = _selectedIndex == index;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        child: Material(
                          color: selected ? PardesColors.primary.withOpacity(0.2) : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => setState(() => _selectedIndex = index),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              child: Row(
                                children: [
                                  Icon(
                                    item.icon,
                                    color: selected ? PardesColors.primary : PardesColors.textSecondary,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    item.label,
                                    style: TextStyle(
                                      color: selected ? PardesColors.textPrimary : PardesColors.textSecondary,
                                      fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // Main content
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
                : _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    switch (_selectedIndex) {
      case 0:
        return const DiscoverScreen();
      case 1:
        return const SearchScreen();
      case 2:
        return const GenresScreen();
      case 3:
        return const SeriesScreen();
      case 4:
        return const TopRatedScreen();
      default:
        return const DiscoverScreen();
    }
  }
}

class NavigationItem {
  final IconData icon;
  final String label;
  NavigationItem({required this.icon, required this.label});
}

class _StatRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: PardesColors.textSecondary),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(color: PardesColors.textSecondary, fontSize: 12)),
        const Spacer(),
        Text(value, style: const TextStyle(color: PardesColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 12)),
      ],
    );
  }
}

// Discover Screen - Random books
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  List<dynamic> _books = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBooks();
  }

  Future<void> _loadBooks() async {
    setState(() => _loading = true);
    try {
      final books = await PardesApi.getRandomBooks(count: 20);
      setState(() {
        _books = books;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            children: [
              const Text(
                'Discover',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: _loadBooks,
                icon: const Icon(Icons.refresh),
                label: const Text('Shuffle'),
                style: TextButton.styleFrom(foregroundColor: PardesColors.primary),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
              : GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 300,
                    childAspectRatio: 0.7,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: _books.length,
                  itemBuilder: (context, index) => BookCard(book: _books[index]),
                ),
        ),
      ],
    );
  }
}

// Search Screen
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _results = [];
  int _total = 0;
  bool _loading = false;
  bool _hasSearched = false;

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() => _loading = true);
    try {
      final data = await PardesApi.searchBooks(query);
      setState(() {
        _results = data['results'] ?? [];
        _total = data['total'] ?? 0;
        _loading = false;
        _hasSearched = true;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Search',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      decoration: const InputDecoration(
                        hintText: 'Search books, authors... (supports transliteration!)',
                        prefixIcon: Icon(Icons.search, color: PardesColors.textSecondary),
                      ),
                      style: const TextStyle(color: PardesColors.textPrimary),
                      onSubmitted: (_) => _search(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _search,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: PardesColors.primary,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Search'),
                  ),
                ],
              ),
              if (_hasSearched)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    'Found $_total results',
                    style: const TextStyle(color: PardesColors.textSecondary),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
              : !_hasSearched
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.search, size: 64, color: PardesColors.textSecondary.withOpacity(0.5)),
                          const SizedBox(height: 16),
                          const Text(
                            'Поиск книг...',
                            style: TextStyle(color: PardesColors.textSecondary, fontSize: 18),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Try "tolstoy" or "война и мир"',
                            style: TextStyle(color: PardesColors.textSecondary.withOpacity(0.7)),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      itemCount: _results.length,
                      itemBuilder: (context, index) => BookListTile(book: _results[index]),
                    ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

// Genres Screen
class GenresScreen extends StatefulWidget {
  const GenresScreen({super.key});

  @override
  State<GenresScreen> createState() => _GenresScreenState();
}

class _GenresScreenState extends State<GenresScreen> {
  List<dynamic> _genres = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadGenres();
  }

  Future<void> _loadGenres() async {
    try {
      final genres = await PardesApi.getGenres();
      setState(() {
        _genres = genres.take(50).toList(); // Top 50 genres
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Genres',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
              : GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 200,
                    childAspectRatio: 2.5,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _genres.length,
                  itemBuilder: (context, index) {
                    final genre = _genres[index];
                    return Material(
                      color: PardesColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => GenreBooksScreen(genre: genre['genre'] as String),
                            ),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                getGenreDisplayName(genre['genre'] as String),
                                style: const TextStyle(
                                  color: PardesColors.textPrimary,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${genre['count']} книг',
                                style: const TextStyle(color: PardesColors.textSecondary, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// Series Screen
class SeriesScreen extends StatefulWidget {
  const SeriesScreen({super.key});

  @override
  State<SeriesScreen> createState() => _SeriesScreenState();
}

class _SeriesScreenState extends State<SeriesScreen> {
  List<dynamic> _series = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSeries();
  }

  Future<void> _loadSeries() async {
    try {
      final series = await PardesApi.getSeries(limit: 50);
      setState(() {
        _series = series;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Series',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  itemCount: _series.length,
                  itemBuilder: (context, index) {
                    final series = _series[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Material(
                        color: PardesColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => SeriesBooksScreen(seriesName: series['series'] as String),
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: PardesColors.primary.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.collections_bookmark, color: PardesColors.primary, size: 20),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        series['series'],
                                        style: const TextStyle(
                                          color: PardesColors.textPrimary,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        '${series['count']} книг',
                                        style: const TextStyle(color: PardesColors.textSecondary, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right, color: PardesColors.textSecondary),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// Top Rated Screen
class TopRatedScreen extends StatefulWidget {
  const TopRatedScreen({super.key});

  @override
  State<TopRatedScreen> createState() => _TopRatedScreenState();
}

class _TopRatedScreenState extends State<TopRatedScreen> {
  List<dynamic> _books = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBooks();
  }

  Future<void> _loadBooks() async {
    try {
      final books = await PardesApi.getTopBooks(limit: 50);
      setState(() {
        _books = books;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Top Rated',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  itemCount: _books.length,
                  itemBuilder: (context, index) => BookListTile(book: _books[index]),
                ),
        ),
      ],
    );
  }
}

// Genre Books Screen - shows books in a specific genre
class GenreBooksScreen extends StatefulWidget {
  final String genre;

  const GenreBooksScreen({super.key, required this.genre});

  @override
  State<GenreBooksScreen> createState() => _GenreBooksScreenState();
}

class _GenreBooksScreenState extends State<GenreBooksScreen> {
  List<dynamic> _books = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBooks();
  }

  Future<void> _loadBooks() async {
    try {
      final data = await PardesApi.getGenreBooks(widget.genre);
      setState(() {
        _books = data['books'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(getGenreDisplayName(widget.genre), style: const TextStyle(color: PardesColors.textPrimary)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: PardesColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
          : _books.isEmpty
              ? const Center(child: Text('Книги не найдены', style: TextStyle(color: PardesColors.textSecondary)))
              : ListView.builder(
                  padding: const EdgeInsets.all(24),
                  itemCount: _books.length,
                  itemBuilder: (context, index) => BookListTile(book: _books[index]),
                ),
    );
  }
}

// Series Books Screen - shows books in a specific series
class SeriesBooksScreen extends StatefulWidget {
  final String seriesName;

  const SeriesBooksScreen({super.key, required this.seriesName});

  @override
  State<SeriesBooksScreen> createState() => _SeriesBooksScreenState();
}

class _SeriesBooksScreenState extends State<SeriesBooksScreen> {
  List<dynamic> _books = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBooks();
  }

  Future<void> _loadBooks() async {
    try {
      final data = await PardesApi.getSeriesBooks(widget.seriesName);
      setState(() {
        _books = data['books'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.seriesName, style: const TextStyle(color: PardesColors.textPrimary)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: PardesColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
          : _books.isEmpty
              ? const Center(child: Text('Книги не найдены', style: TextStyle(color: PardesColors.textSecondary)))
              : ListView.builder(
                  padding: const EdgeInsets.all(24),
                  itemCount: _books.length,
                  itemBuilder: (context, index) {
                    final book = _books[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Material(
                        color: PardesColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: book['id'])),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(
                                    '${PardesApi.baseUrl}/books/${book['id']}/cover',
                                    width: 50,
                                    height: 70,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      width: 50,
                                      height: 70,
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [PardesColors.primary.withOpacity(0.3), PardesColors.secondary.withOpacity(0.3)],
                                        ),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Icon(Icons.menu_book, color: PardesColors.textSecondary),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (book['seriesNum'] != null)
                                        Text(
                                          '#${book['seriesNum']}',
                                          style: TextStyle(
                                            color: PardesColors.primary.withOpacity(0.8),
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      Text(
                                        book['title'] ?? 'Unknown',
                                        style: const TextStyle(color: PardesColors.textPrimary, fontWeight: FontWeight.w600),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        (book['authors'] as List?)?.map((a) => a['lastName'] ?? '').join(', ') ?? '',
                                        style: const TextStyle(color: PardesColors.textSecondary, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                                if (book['rating'] != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: PardesColors.accent.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.star, size: 14, color: PardesColors.accent),
                                        const SizedBox(width: 4),
                                        Text('${book['rating']}', style: const TextStyle(color: PardesColors.accent, fontWeight: FontWeight.bold)),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

// Book Card Widget (for grid view)
class BookCard extends StatelessWidget {
  final Map<String, dynamic> book;

  const BookCard({super.key, required this.book});

  @override
  Widget build(BuildContext context) {
    final authors = (book['authors'] as List?)?.map((a) => a['lastName'] ?? '').join(', ') ?? 'Unknown';
    final rating = book['rating'];

    return Material(
      color: PardesColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openBook(context),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Book cover image
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    '${PardesApi.baseUrl}/books/${book['id']}/cover',
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            PardesColors.primary.withOpacity(0.3),
                            PardesColors.secondary.withOpacity(0.3),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.menu_book, size: 48, color: PardesColors.textSecondary),
                    ),
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: PardesColors.surfaceLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                book['title'] ?? 'Unknown',
                style: const TextStyle(
                  color: PardesColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                authors,
                style: const TextStyle(color: PardesColors.textSecondary, fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (rating != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.star, size: 14, color: PardesColors.accent),
                    const SizedBox(width: 4),
                    Text(
                      '$rating',
                      style: const TextStyle(color: PardesColors.accent, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _openBook(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: book['id'])),
    );
  }
}

// Book List Tile (for list view)
class BookListTile extends StatelessWidget {
  final Map<String, dynamic> book;

  const BookListTile({super.key, required this.book});

  @override
  Widget build(BuildContext context) {
    final authors = (book['authors'] as List?)?.map((a) => a['lastName'] ?? '').join(', ') ?? 'Unknown';
    final rating = book['rating'];
    final genres = (book['genres'] as List?)?.take(2).map((g) => getGenreDisplayName(g as String)).join(', ') ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: PardesColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: book['id'])),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    '${PardesApi.baseUrl}/books/${book['id']}/cover',
                    width: 50,
                    height: 70,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 50,
                      height: 70,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [PardesColors.primary.withOpacity(0.3), PardesColors.secondary.withOpacity(0.3)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.menu_book, color: PardesColors.textSecondary),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        book['title'] ?? 'Unknown',
                        style: const TextStyle(color: PardesColors.textPrimary, fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        authors,
                        style: const TextStyle(color: PardesColors.textSecondary, fontSize: 13),
                      ),
                      if (genres.isNotEmpty)
                        Text(
                          genres,
                          style: TextStyle(color: PardesColors.textSecondary.withOpacity(0.7), fontSize: 12),
                        ),
                    ],
                  ),
                ),
                if (rating != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: PardesColors.accent.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star, size: 14, color: PardesColors.accent),
                        const SizedBox(width: 4),
                        Text('$rating', style: const TextStyle(color: PardesColors.accent, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Book Detail Screen
class BookDetailScreen extends StatefulWidget {
  final int bookId;

  const BookDetailScreen({super.key, required this.bookId});

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  Map<String, dynamic>? _book;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBook();
  }

  Future<void> _loadBook() async {
    try {
      final book = await PardesApi.getBook(widget.bookId);
      setState(() {
        _book = book;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_book?['title'] ?? 'Loading...', style: const TextStyle(color: PardesColors.textPrimary)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: PardesColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download, color: PardesColors.primary),
            onPressed: _book == null ? null : () => _downloadBook(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
          : _book == null
              ? const Center(child: Text('Book not found', style: TextStyle(color: PardesColors.textSecondary)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Book header
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              '${PardesApi.baseUrl}/books/${widget.bookId}/cover',
                              width: 150,
                              height: 220,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 150,
                                height: 220,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [PardesColors.primary.withOpacity(0.4), PardesColors.secondary.withOpacity(0.4)],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.menu_book, size: 64, color: PardesColors.textSecondary),
                              ),
                              loadingBuilder: (context, child, loadingProgress) {
                                if (loadingProgress == null) return child;
                                return Container(
                                  width: 150,
                                  height: 220,
                                  decoration: BoxDecoration(
                                    color: PardesColors.surfaceLight,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: 24),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _book!['title'] ?? 'Unknown',
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: PardesColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  (_book!['authors'] as List?)?.map((a) => '${a['firstName'] ?? ''} ${a['lastName'] ?? ''}'.trim()).join(', ') ?? 'Unknown Author',
                                  style: const TextStyle(fontSize: 16, color: PardesColors.textSecondary),
                                ),
                                if (_book!['rating'] != null) ...[
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      ...List.generate(5, (i) => Icon(
                                        i < (_book!['rating'] ?? 0) ? Icons.star : Icons.star_border,
                                        color: PardesColors.accent,
                                        size: 20,
                                      )),
                                    ],
                                  ),
                                ],
                                const SizedBox(height: 16),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: (_book!['genres'] as List? ?? []).map<Widget>((g) => Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: PardesColors.surfaceLight,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      getGenreDisplayName(g as String),
                                      style: const TextStyle(color: PardesColors.textSecondary, fontSize: 12),
                                    ),
                                  )).toList(),
                                ),
                                const SizedBox(height: 24),
                                ElevatedButton.icon(
                                  onPressed: () => _openReader(),
                                  icon: const Icon(Icons.chrome_reader_mode),
                                  label: const Text('Читать'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: PardesColors.primary,
                                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // More by author
                      if ((_book!['moreByAuthor'] as List?)?.isNotEmpty ?? false) ...[
                        const SizedBox(height: 32),
                        const Text(
                          'More by this author',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
                        ),
                        const SizedBox(height: 12),
                        ...(_book!['moreByAuthor'] as List).map((b) => ListTile(
                          leading: const Icon(Icons.book, color: PardesColors.primary),
                          title: Text(b['title'], style: const TextStyle(color: PardesColors.textPrimary)),
                          onTap: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: b['id'])),
                            );
                          },
                        )),
                      ],

                      // Series books
                      if ((_book!['seriesBooks'] as List?)?.isNotEmpty ?? false) ...[
                        const SizedBox(height: 32),
                        Text(
                          'Series: ${_book!['series']}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: PardesColors.textPrimary),
                        ),
                        const SizedBox(height: 12),
                        ...(_book!['seriesBooks'] as List).map((b) => ListTile(
                          leading: CircleAvatar(
                            backgroundColor: PardesColors.primary.withOpacity(0.2),
                            child: Text('${b['seriesNum'] ?? '?'}', style: const TextStyle(color: PardesColors.primary)),
                          ),
                          title: Text(b['title'], style: const TextStyle(color: PardesColors.textPrimary)),
                          onTap: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: b['id'])),
                            );
                          },
                        )),
                      ],
                    ],
                  ),
                ),
    );
  }

  void _downloadBook() {
    // TODO: Implement download
    final url = PardesApi.getDownloadUrl(widget.bookId);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Download URL: $url')),
    );
  }

  void _openReader() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ReaderScreen(bookId: widget.bookId, title: _book!['title'] ?? 'Book')),
    );
  }
}

// Reader Screen
class ReaderScreen extends StatefulWidget {
  final int bookId;
  final String title;

  const ReaderScreen({super.key, required this.bookId, required this.title});

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  Map<String, dynamic>? _content;
  bool _loading = true;
  int _currentChapter = 0;
  double _fontSize = 16;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    try {
      final content = await PardesApi.getBookContent(widget.bookId);
      setState(() {
        _content = content;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chapters = _content?['chapters'] as List? ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(color: PardesColors.textPrimary)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: PardesColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.text_decrease, color: PardesColors.textSecondary),
            onPressed: () => setState(() => _fontSize = (_fontSize - 2).clamp(12, 24)),
          ),
          IconButton(
            icon: const Icon(Icons.text_increase, color: PardesColors.textSecondary),
            onPressed: () => setState(() => _fontSize = (_fontSize + 2).clamp(12, 24)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PardesColors.primary))
          : chapters.isEmpty
              ? const Center(child: Text('No content available', style: TextStyle(color: PardesColors.textSecondary)))
              : Row(
                  children: [
                    // Chapter list sidebar
                    if (chapters.length > 1)
                      Container(
                        width: 200,
                        color: PardesColors.surface,
                        child: ListView.builder(
                          itemCount: chapters.length,
                          itemBuilder: (context, index) {
                            final chapter = chapters[index];
                            final selected = _currentChapter == index;
                            return ListTile(
                              selected: selected,
                              selectedTileColor: PardesColors.primary.withOpacity(0.2),
                              title: Text(
                                chapter['title'] ?? 'Chapter ${index + 1}',
                                style: TextStyle(
                                  color: selected ? PardesColors.primary : PardesColors.textSecondary,
                                  fontSize: 13,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: () => setState(() => _currentChapter = index),
                            );
                          },
                        ),
                      ),

                    // Content
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              chapters[_currentChapter]['title'] ?? '',
                              style: TextStyle(
                                fontSize: _fontSize + 8,
                                fontWeight: FontWeight.bold,
                                color: PardesColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 24),
                            SelectableText(
                              chapters[_currentChapter]['content'] ?? '',
                              style: TextStyle(
                                fontSize: _fontSize,
                                color: PardesColors.textPrimary,
                                height: 1.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: chapters.length > 1
          ? Container(
              color: PardesColors.surface,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton.icon(
                    onPressed: _currentChapter > 0 ? () => setState(() => _currentChapter--) : null,
                    icon: const Icon(Icons.arrow_back),
                    label: const Text('Previous'),
                  ),
                  Text(
                    'Chapter ${_currentChapter + 1} of ${chapters.length}',
                    style: const TextStyle(color: PardesColors.textSecondary),
                  ),
                  TextButton.icon(
                    onPressed: _currentChapter < chapters.length - 1 ? () => setState(() => _currentChapter++) : null,
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('Next'),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
