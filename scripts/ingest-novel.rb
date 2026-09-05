#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Ingest one OR MORE novels from the novel-pipeline output into the site.
#
# Default source:  ~/novel-hwang/novel-list/output/<any-dir>/chapters/NN.md
# Extra stores:    ruby scripts/ingest-novel.rb [--slug SLUG] [--title TITLE] /path/to/store
#                  (store = directory that contains chapters/)
#
# For every source dir that contains a chapters/ folder this writes:
#   _novel/<slug>/NN.md      -> a chapter (permalink /novel/<slug>/NN/)
#   _novel/<slug>/index.html -> that novel's landing (permalink /novel/<slug>/)
#   audio/<slug>/NN.mp3      -> chapter audio when media/chNNN/chNNN.mp3 exists
# and it maintains _data/novels.yml (the library index).
#
# _data/novels.yml keeps a hand-editable `synopsis`, `tagline`, and `status`
# per novel: those are PRESERVED across re-runs (only slug/title/chapters/audio
# are refreshed). Novels already in the index but not in this run are kept.
# Safe to re-run whenever chapters are added.
#
#   ruby scripts/ingest-novel.rb
#   ruby scripts/ingest-novel.rb --slug dieu-khoan-cuoi --title "Điều Khoản Cuối" \
#        ~/novel-hwang/dieu-khoan-cuoi/output/novel

require 'fileutils'
require 'yaml'

SRC_ROOT   = File.expand_path('~/novel-hwang/novel-list/output')
REPO       = File.expand_path(File.join(__dir__, '..'))
NOVEL_DIR  = File.join(REPO, '_novel')
AUDIO_DIR  = File.join(REPO, 'audio')
DATA_FILE  = File.join(REPO, '_data', 'novels.yml')

def parse_args(argv)
  slug = nil
  title = nil
  extras = []
  i = 0
  while i < argv.length
    case argv[i]
    when '--slug'
      abort 'missing --slug value' if i + 1 >= argv.length
      slug = argv[i + 1]
      i += 2
    when '--title'
      abort 'missing --title value' if i + 1 >= argv.length
      title = argv[i + 1]
      i += 2
    else
      extras << File.expand_path(argv[i])
      i += 1
    end
  end
  { slug: slug, title: title, extras: extras }
end

# Vietnamese-aware slug: strip diacritics, map đ, keep [a-z0-9-].
def slugify(str)
  str.unicode_normalize(:nfd)
     .gsub(/\p{Mn}/, '')
     .gsub(/[đĐ]/, 'd')
     .downcase
     .gsub(/[^a-z0-9]+/, '-')
     .gsub(/\A-+|-+\z/, '')
end

def yaml_str(str)
  '"' + str.gsub('\\', '\\\\').gsub('"', '\"') + '"'
end

def xml_escape(str)
  str.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;')
     .gsub('"', '&quot;').gsub("'", '&apos;')
end

# Per-novel Atom feed. Front matter fixes the output path; the Liquid body
# resolves that novel's chapters at build time (newest first, capped) so the
# feed stays current without the ingest script re-running. `SITE` is hardcoded
# because _config.yml `url` omits the protocol.
SITE = 'https://hoang.tech'
def feed_source(slug, title, subtitle)
  base = "#{SITE}/novel/#{slug}/"
  <<~FEED
    ---
    layout: null
    permalink: /novel/#{slug}/feed.xml
    sitemap: false
    ---
    <?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>#{xml_escape(title)}</title>
      <subtitle>#{xml_escape(subtitle)}</subtitle>
      <link href="#{base}feed.xml" rel="self" type="application/atom+xml"/>
      <link href="#{base}" rel="alternate" type="text/html"/>
      <id>#{base}</id>
      <updated>{{ site.time | date_to_xmlschema }}</updated>
      {%- assign chapters = site.novel | where: "novel", "#{slug}" | where_exp: "c", "c.chapter" | sort: "chapter" | reverse -%}
      {%- for c in chapters limit: 30 %}
      <entry>
        <title>{{ c.title | xml_escape }}</title>
        <link href="#{SITE}{{ c.url }}" rel="alternate" type="text/html"/>
        <id>#{SITE}{{ c.url }}</id>
        <updated>{{ site.time | date_to_xmlschema }}</updated>
      </entry>
      {%- endfor %}
    </feed>
  FEED
end

def load_outline_titles(ndir)
  path = File.join(ndir, 'outline.md')
  titles = {}
  return titles unless File.exist?(path)
  File.foreach(path, encoding: 'UTF-8') do |line|
    next unless line.strip =~ /\A##\s+Chương\s+(\d+)\s*[:：]\s*(.+)\z/
    titles[Regexp.last_match(1).to_i] = Regexp.last_match(2).strip
  end
  titles
end

def chapter_title(num, heading, outline)
  return heading unless heading.nil? || heading.empty?
  named = outline[num]
  return "Chương #{num} — #{named}" if named && !named.empty?
  "Chương #{num}"
end

def copy_chapter_audio(ndir, slug, num, name)
  pad3 = format('ch%03d', num)
  src = File.join(ndir, 'media', pad3, "#{pad3}.mp3")
  return nil unless File.file?(src)
  dest_dir = File.join(AUDIO_DIR, slug)
  FileUtils.mkdir_p(dest_dir)
  dest_name = "#{name}.mp3"
  FileUtils.cp(src, File.join(dest_dir, dest_name))
  "/audio/#{slug}/#{dest_name}"
end

def ingest_store(ndir, novels, existing, overrides = {})
  chapters_dir = File.join(ndir, 'chapters')
  return unless Dir.exist?(chapters_dir)

  title = overrides[:title]
  seed  = ''
  premise = File.join(ndir, 'premise.md')
  if File.exist?(premise)
    plines = File.readlines(premise, encoding: 'UTF-8')
    hidx = plines.index { |l| l =~ /\A#\s+/ }
    title = plines[hidx].sub(/\A#\s+/, '').strip if (title.nil? || title.empty?) && hidx
    body  = hidx ? plines[(hidx + 1)..-1] : plines
    seed  = (body.find { |l| !l.strip.empty? && !l.strip.start_with?('#') } || '').strip
  end
  title = File.basename(ndir) if title.nil? || title.empty?
  slug = overrides[:slug]
  slug = slugify(title) if slug.nil? || slug.empty?
  slug = File.basename(ndir) if slug.empty?

  out = File.join(NOVEL_DIR, slug)
  FileUtils.rm_rf(out)
  FileUtils.mkdir_p(out)
  if Dir.exist?(File.join(ndir, 'media'))
    FileUtils.rm_rf(File.join(AUDIO_DIR, slug))
  end

  outline = load_outline_titles(ndir)
  count = 0
  has_audio = false
  Dir.glob(File.join(chapters_dir, '*.md')).sort.each do |path|
    name = File.basename(path, '.md')
    next unless name =~ /\A\d+\z/
    num = name.to_i
    clines = File.readlines(path, encoding: 'UTF-8')
    cidx = clines.index { |l| l =~ /\A#\s+/ }
    if cidx
      heading = clines[cidx].sub(/\A#\s+/, '').strip
      cbody  = (clines[0...cidx] + clines[(cidx + 1)..-1]).join
    else
      heading = nil
      cbody  = clines.join
    end
    ctitle = chapter_title(num, heading, outline)
    audio = copy_chapter_audio(ndir, slug, num, name)
    has_audio = true if audio
    fm = +"---\n"
    fm << "layout: novel\n"
    fm << "novel: #{slug}\n"
    fm << "novel_title: #{yaml_str(title)}\n"
    fm << "chapter: #{num}\n"
    fm << "title: #{yaml_str(ctitle)}\n"
    fm << "theme: reading\n"
    fm << "audio: #{audio}\n" if audio
    fm << "---\n\n"
    File.write(File.join(out, "#{name}.md"), fm + cbody.sub(/\A\s+/, ''))
    count += 1
  end

  ifm = +"---\n"
  ifm << "layout: novel-home\n"
  ifm << "novel: #{slug}\n"
  ifm << "permalink: /novel/#{slug}/\n"
  ifm << "title: #{yaml_str(title)}\n"
  ifm << "theme: reading\n"
  ifm << "sitemap: false\n"
  ifm << "---\n"
  File.write(File.join(out, 'index.html'), ifm)

  prev = existing[slug] || {}
  subtitle = prev['tagline']
  subtitle = seed if subtitle.nil? || subtitle.empty?
  File.write(File.join(out, 'feed.xml'), feed_source(slug, title, subtitle))

  entry = {
    'slug'     => slug,
    'title'    => title,
    'chapters' => count,
    'tagline'  => prev['tagline'] || '',
    'synopsis' => prev['synopsis'] || seed,
    'status'   => prev['status'] || 'Đang cập nhật',
  }
  entry['audio'] = true if has_audio || prev['audio']
  novels << entry
end

args = parse_args(ARGV)
args[:extras].each do |p|
  abort "source not found: #{p}" unless Dir.exist?(p)
  abort "no chapters/ in #{p}" unless Dir.exist?(File.join(p, 'chapters'))
end

existing = {}
if File.exist?(DATA_FILE)
  (YAML.load_file(DATA_FILE) || []).each { |n| existing[n['slug']] = n }
end

FileUtils.mkdir_p(NOVEL_DIR)
novels = []

if Dir.exist?(SRC_ROOT)
  Dir.glob(File.join(SRC_ROOT, '*')).sort.each do |ndir|
    next unless File.directory?(ndir)
    ingest_store(ndir, novels, existing)
  end
elsif args[:extras].empty?
  abort "source not found: #{SRC_ROOT}"
end

args[:extras].each do |ndir|
  ingest_store(ndir, novels, existing, slug: args[:slug], title: args[:title])
end

seen = novels.map { |n| n['slug'] }
existing.each do |slug, n|
  novels << n unless seen.include?(slug)
end

FileUtils.mkdir_p(File.dirname(DATA_FILE))
File.write(DATA_FILE, novels.to_yaml)
puts "processed #{novels.size} novel(s): " +
     novels.map { |n| "#{n['slug']} (#{n['chapters']} ch#{n['audio'] ? ', audio' : ''})" }.join(', ')
