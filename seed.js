// Starting data. Loaded into the database the first time the app opens with an empty one.
// Boys = Awana Cubbies HoneyComb (short versions, ESV). Parents = our own list.
window.SEED = (function () {
  var B = function (n, ord, label, ref, body, review) {
    return { id: "s" + n, list_id: "boys", ord: ord, label: label, ref: ref, body: body, status: n === "01" ? "learning" : "todo", review: !!review, custom: false };
  };
  var P = function (id, ord, label, ref, body, status) {
    return { id: id, list_id: "parents", ord: ord, label: label, ref: ref, body: body, status: status || "todo", review: false, custom: true };
  };
  var REV411 = "…Worthy are You, our Lord and God…For You created all things…";
  var J1027 = "My sheep hear My voice, and I know them, and they follow Me.";
  var J414 = "…The Father has sent His Son to be the Savior of the world.";
  var M1615 = "…Go into all the world and proclaim the gospel to the whole creation.";
  return {
    lists: [
      { id: "boys", name: "Boys", ord: 1, current_verse: "s01" },
      { id: "parents", name: "Parents", ord: 2, current_verse: "p-isa30-18" }
    ],
    verses: [
      B("01", 1, "Bear Hug 1", "Romans 3:23", "…All have sinned…"),
      B("02", 2, "Bear Hug 2", "Romans 5:8", "…While we were still sinners, Christ died for us."),
      B("03", 3, "Bear Hug 3", "Revelation 4:11", REV411),
      B("04", 4, "Bear Hug 4", "Psalm 139:14", "…I praise You, for I am fearfully and wonderfully made…"),
      B("05", 5, "Bear Hug 5", "Ephesians 6:1", "…Children, obey your parents in the Lord, for this is right."),
      B("06", 6, "Bear Hug 6", "Revelation 4:11", REV411, true),
      B("07", 7, "Bear Hug 7", "Matthew 4:10", "…Worship the Lord your God, and Him only shall you serve."),
      B("08", 8, "Bear Hug 8", "Jeremiah 10:10", "…The LORD is the true God; He is the living God and the everlasting King…"),
      B("09", 9, "Bear Hug 9", "Psalm 31:14", "…But I trust in You, O LORD; I say ‘You are my God.’"),
      B("10", 10, "Special 1", "Psalm 100:4", "Enter His gates with Thanksgiving, and His courts with praise…"),
      B("11", 11, "Bear Hug 11", "John 10:27", J1027),
      B("12", 12, "Bear Hug 12", "Isaiah 53:6", "All we like sheep have gone astray; we have turned—every one—to his own way…"),
      B("13", 13, "Special 2", "Luke 1:49", "For He who is mighty has done great things for me, and holy is His name."),
      B("14", 14, "Bear Hug 13", "Psalm 23:4", "…I will fear no evil, for You are with me; Your rod and Your staff, they comfort me."),
      B("15", 15, "Bear Hug 14", "John 10:27", J1027, true),
      B("16", 16, "Bear Hug 15", "Matthew 1:21", "Call His name Jesus, for He will save His people from their sins."),
      B("17", 17, "Bear Hug 16", "1 John 5:11", "…God gave us eternal life, and this life is in His Son."),
      B("18", 18, "Bear Hug 17", "Matthew 6:11", "Give us this day our daily bread."),
      B("19", 19, "Special 3", "Matthew 22:39", "…You shall love your neighbor as yourself."),
      B("20", 20, "Bear Hug 19", "1 John 4:14", J414),
      B("21", 21, "Bear Hug 20", "1 Timothy 1:15", "…Christ Jesus came into the world to save sinners…"),
      B("22", 22, "Bear Hug 21", "1 Corinthians 15:3-4", "…Christ died for our sins…He was buried…He was raised on the third day…"),
      B("23", 23, "Bear Hug 22", "1 John 4:14", J414, true),
      B("24", 24, "Bear Hug 23", "Mark 16:15", M1615),
      B("25", 25, "Bear Hug 24", "Romans 10:15", "…How beautiful are the feet of those who preach the good news!"),
      B("26", 26, "Bear Hug 25", "Acts 16:31", "…Believe in the Lord Jesus, and you will be saved…"),
      B("27", 27, "Bear Hug 26", "Mark 16:15", M1615, true),

      P("p-isa30-18", 0, "Mom's pick", "Isaiah 30:18", "Therefore the LORD waits to be gracious to you, and therefore he exalts himself to show mercy to you. For the LORD is a God of justice; blessed are all those who wait for him.", "learning"),
      P("p-james3-17", 0.5, "Up next", "James 3:17-18", "But the wisdom from above is first pure, then peaceable, gentle, open to reason, full of mercy and good fruits, impartial and sincere. And a harvest of righteousness is sown in peace by those who make peace."),
      P("p-col3-12", 0.75, "After that", "Colossians 3:12-17", "Put on then, as God's chosen ones, holy and beloved, compassionate hearts, kindness, humility, meekness, and patience, bearing with one another and, if one has a complaint against another, forgiving each other; as the Lord has forgiven you, so you also must forgive. And above all these put on love, which binds everything together in perfect harmony. And let the peace of Christ rule in your hearts, to which indeed you were called in one body. And be thankful. Let the word of Christ dwell in you richly, teaching and admonishing one another in all wisdom, singing psalms and hymns and spiritual songs, with thankfulness in your hearts to God. And whatever you do, in word or deed, do everything in the name of the Lord Jesus, giving thanks to God the Father through him."),
      P("d01", 1, "Starter pick", "Proverbs 3:5-6", "Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths."),
      P("d02", 2, "Starter pick", "Joshua 1:9", "Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go."),
      P("d03", 3, "Starter pick", "Deuteronomy 6:6-7", "And these words that I command you today shall be on your heart. You shall teach them diligently to your children, and shall talk of them when you sit in your house, and when you walk by the way, and when you lie down, and when you rise."),
      P("d04", 4, "Starter pick", "Psalm 46:10", "Be still, and know that I am God. I will be exalted among the nations, I will be exalted in the earth!"),
      P("d05", 5, "Starter pick", "Colossians 3:23", "Whatever you do, work heartily, as for the Lord and not for men,"),
      P("m01", 6, "Starter pick", "Isaiah 41:10", "fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand."),
      P("m02", 7, "Starter pick", "Philippians 4:6-7", "do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus."),
      P("m03", 8, "Starter pick", "Matthew 11:28", "Come to me, all who labor and are heavy laden, and I will give you rest."),
      P("m04", 9, "Starter pick", "1 Thessalonians 5:16-18", "Rejoice always, pray without ceasing, give thanks in all circumstances; for this is the will of God in Christ Jesus for you."),
      P("m05", 10, "Starter pick", "Psalm 127:3", "Behold, children are a heritage from the LORD, the fruit of the womb a reward.")
    ]
  };
})();
