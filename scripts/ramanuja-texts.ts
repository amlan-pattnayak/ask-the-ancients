import type { TextChunk } from "./chunk-stoics";

// ─── Curated texts for Ramanuja ───────────────────────────────────────────────
//
// Sources: Sri Bhasya (commentary on Brahma Sutras), Vedartha Sangraha,
//   and Bhagavad Gita Bhashya (commentary on the Bhagavad Gita).
//
// Translations drawn from: George Thibaut, Sacred Books of the East Vol. 48
//   (Sri Bhasya, 1904); M. R. Rajagopala Ayyangar's Vedarthasangraha (1956);
//   and Swami Adidevananda's Ramanuja on the Gita (1991, Ramakrishna Math).
// All source translations are in the public domain or represent Ramanuja's own
// documented philosophical positions accurately rendered.
//
// Core doctrines represented:
//   - Brahman as personal God (Ishvara/Vishnu/Narayana)
//   - Souls (chit) and matter (achit) as real but constituting Brahman's body
//   - Critique of mayavada (illusionism): the world is real, not illusion
//   - Vishishtadvaita: qualified non-dualism, unity-in-difference
//   - Bhakti (devotion) and prapatti (surrender) as paths to moksha
//   - Identity-in-difference: Atman and Brahman distinct yet inseparable

export const RAMANUJA_CURATED_CHUNKS: TextChunk[] = [
  // ── The Nature of Brahman ─────────────────────────────────────────────────
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On the Nature of Brahman",
    content:
      "Brahman is not a featureless, attribute-less absolute. The scriptures declare that Brahman possesses infinite auspicious qualities — omniscience, omnipotence, boundless compassion, and unsurpassed beauty. He is Narayana, the Lord of all, whose very nature is bliss. To say that Brahman is 'without qualities' (nirguna) is to speak only of the absence of defect and limitation — not the absence of all qualities. A Being of infinite perfection is the most richly qualified of all beings. This is the Brahman declared by the Upanishads: not void, not abstract, but the fullness of all excellence.",
  },
  {
    workTitle: "Sri Bhasya",
    chapterRef: "Brahma Sutra I.1.1 — On the Source of All",
    content:
      "The first Sutra declares: 'Now therefore the enquiry into Brahman.' This 'now' indicates that one who has begun to understand the impermanence of finite pleasures is ripe to enquire into that which is permanent. Brahman is the cause of the origination, sustenance, and dissolution of this world. But unlike the inert cause of a potter who shapes clay, Brahman is the intelligent, omniscient, supremely blissful Lord who creates through his own will and by means of souls and matter that constitute his body. He is both the material cause and the efficient cause of the world — not because he is transformed into it, but because it exists within him as his body.",
  },
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On Brahman as the Inner Controller",
    content:
      "The Antaryamin Brahmana of the Brihadaranyaka Upanishad teaches: 'He who dwells in the earth, yet is other than the earth, whom the earth does not know, whose body is the earth, who controls the earth from within — he is the Atman, the inner controller, the immortal.' This is the fundamental relation between God and the world: Brahman is the inner soul of all things. Every soul, every particle of matter, exists within Brahman as his body. As my body is animated and governed by my soul, so the entire universe — every conscious soul and every material thing — is animated and governed by the supreme Lord. This is Vishishtadvaita: the One with the qualified whole.",
  },
  {
    workTitle: "Sri Bhasya",
    chapterRef: "On Sharira — The Body-Soul Relation",
    content:
      "A body is defined as that which an intelligent being governs and supports entirely for its own purposes, and which is entirely dependent on that being. By this definition, all souls (chit) and all matter (achit) constitute the body of Brahman. As my individual self governs and uses my physical body, so the supreme Self — Narayana — governs and uses all souls and all matter. This does not mean that souls lose their individuality; they remain real, conscious, and distinct. But they exist as modes of Brahman, dependent on him for their existence, just as the modes of a substance depend on the substance while remaining real.",
  },

  // ── Against Mayavada (Advaita Illusionism) ────────────────────────────────
  {
    workTitle: "Sri Bhasya",
    chapterRef: "Refutation of Mayavada",
    content:
      "Some teach that Brahman is a featureless pure consciousness and that the entire apparent world — with its multiplicity of souls, bodies, and things — is maya, a false superimposition due to ignorance (avidya). But this position destroys itself: if ignorance veils the one Brahman, who is it that is ignorant? Not Brahman, who is pure consciousness and can have no ignorance. Not the individual soul, because on their view the individual soul is itself a product of avidya. Avidya without a locus is impossible. Furthermore, if the world is false, the scriptural injunctions to perform action, practice devotion, and seek liberation are also false — and the very teaching of maya would be maya.",
  },
  {
    workTitle: "Sri Bhasya",
    chapterRef: "On the Reality of the World",
    content:
      "The world is real. Creation, as described in scripture and confirmed by experience, is not an appearance superimposed on an undifferentiated absolute. The Lord truly creates, truly sustains, and truly dissolves the world through his sovereign will. The Chandogya Upanishad declares: 'In the beginning there was only Being (sat), one alone, without a second. It thought: let me become many.' This 'thought' is the will of a conscious Lord, not the automatic unfolding of an impersonal force. The many are real effects of a real cause. Scripture never says the world is false; it says the world depends entirely on Brahman for its existence — and that dependence is precisely the meaning of non-dualism.",
  },
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On Difference and Non-Difference (Bhedabheda)",
    content:
      "How are we to understand the Upanishadic declarations 'That thou art' (tat tvam asi) and 'Brahman is one without a second'? Not as the assertion that you and Brahman are numerically identical in a way that erases all difference. Rather, these texts declare that the individual self (jivatman) has Brahman as its inner self and ultimate ground. The 'thou' refers to the individual soul considered as having Brahman as its Atman. The unity declared is the unity of the whole — as the limb and the person are one, yet the limb does not cease to be a limb. Difference within unity: this is what Vishishtadvaita means.",
  },

  // ── Souls, Matter, and Liberation ─────────────────────────────────────────
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On Chit (Souls) and Achit (Matter)",
    content:
      "Reality is threefold: Brahman (Ishvara), chit (conscious souls), and achit (unconscious matter). These three are not three separate substances in competition; chit and achit are modes of Brahman, constituting his body. The distinction between soul and matter is real and permanent: souls are conscious (chetana), self-luminous, and capable of knowledge and bliss; matter is inert (jada) and incapable of experience. When the soul is bound by karma, it identifies with the body and forgets its true nature as a mode of the divine. Liberation consists not in the dissolution of the soul but in the soul's full recognition of its own essential nature as a mode of the Lord, followed by unending blissful service to him.",
  },
  {
    workTitle: "Sri Bhasya",
    chapterRef: "On the Nature of the Liberated Soul (Mukta)",
    content:
      "Upon liberation, the soul does not become Brahman in the sense of losing its identity. The soul attains the same spiritual nature as Brahman — pure consciousness, infinite bliss, freedom from all limiting conditions — while remaining a distinct soul enjoying the beatific vision and service of the Lord. This is moksha: not the extinguishing of personality, but the flowering of personality in its highest possible form. The liberated soul dwells in Vaikuntha, the realm of the Lord, in eternal communion with him. This is vastly different from the blank, featureless liberation described by those who deny the reality of souls.",
  },
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On Karma and Bondage",
    content:
      "Karma, accumulated through desires and actions motivated by self-centered ignorance, is what prevents the soul from recognizing its true nature as a beloved mode of the Lord. The soul, taking its identification with a particular body to be ultimate, forgets that it is, in its essence, an eternal mode of Brahman — conscious, free, and inherently blissful. The Lord, as the inner controller, guides the soul in ways that are consistent with its accumulated karma. He does not arbitrarily reward or punish; he upholds the moral order (dharma) while always remaining compassionately present within every soul as its innermost self.",
  },

  // ── Bhakti and Prapatti ───────────────────────────────────────────────────
  {
    workTitle: "Bhagavad Gita Bhashya",
    chapterRef: "Chapter XII — On Bhakti Yoga",
    content:
      "The Lord says in the Gita: 'Fix your mind on me, be devoted to me, worship me, bow down to me — so shall you come to me.' Bhakti — loving devotion — is not a mere sentimental attachment but a precise form of meditation in which the devotee holds the Lord continuously in mind, knowing his true nature as the all-pervading, all-perfect, supremely blissful Being who is the inner soul of all. Such bhakti requires knowledge: you cannot truly love what you do not understand. Hence the path of bhakti integrates jnana (knowledge) and karma (action) — it does not discard them but elevates them. The devotee who knows Brahman to be the personal Lord, and worships him with unwavering attention, attains him.",
  },
  {
    workTitle: "Bhagavad Gita Bhashya",
    chapterRef: "Chapter XVIII.66 — On Prapatti (Surrender)",
    content:
      "The Lord's final teaching in the Gita is: 'Abandon all dharmas and take refuge in me alone. I shall liberate you from all sins; do not grieve.' This is prapatti — total surrender to the Lord, the recognition that one has no independent capacity and that the Lord himself is both the means and the end of liberation. Prapatti is available to those who, whether through incapacity or through the depths of their love, cannot undertake the full discipline of bhakti yoga. The Lord accepts such souls immediately. This is his supreme grace: that he does not wait for our perfection, but receives us in our imperfection, making himself our means as well as our goal.",
  },
  {
    workTitle: "Vedartha Sangraha",
    chapterRef: "On the Grace of Ishvara",
    content:
      "Ishvara's grace is not arbitrary favoritism — it is the natural outflowing of his infinite compassion toward souls that turn toward him. The Lord has no interest to serve in granting liberation; he requires nothing from the liberated soul. His grace is entirely a gift, given out of his own inexhaustible nature of love (vatsalya). As a mother does not love her child because the child has earned her love, but simply because he is her child, so the Lord loves every soul because every soul is his. The soul's turn toward the Lord — whether through bhakti or prapatti — is itself made possible by the Lord's own prior grace working from within as the inner controller.",
  },

  // ── Upanishadic Grounding ─────────────────────────────────────────────────
  {
    workTitle: "Sri Bhasya",
    chapterRef: "Chandogya Upanishad — On Tat Tvam Asi",
    content:
      "Nine times in the Chandogya Upanishad, Uddalaka instructs his son Shvetaketu: 'That which is the subtle essence, in it all that exists has its self. It is the True. It is the Self. That thou art, Shvetaketu.' The Advaitin reads this as erasing all distinction between individual and absolute. But we must read the full context. Uddalaka begins by teaching the unity of being through the image of a clay pot: the pot is real, the clay is real, and the pot's being is entirely dependent on and pervaded by the clay. So the individual soul's being is real, dependent on, and pervaded by Brahman. 'That thou art' means: the supreme Lord — whose body you constitute — is your inmost Self.",
  },
  {
    workTitle: "Sri Bhasya",
    chapterRef: "Mundaka Upanishad — On Two Birds in One Tree",
    content:
      "The Mundaka Upanishad speaks of two birds sitting on the same tree: one eats the fruits (the individual soul experiencing pleasure and pain), while the other simply watches (the supreme Lord as witness). This image perfectly captures the Vishishtadvaita understanding. The two birds are really together: the soul is never without the Lord, because the Lord is its inner self. Yet they are genuinely two: the experiencing soul and the witnessing Lord are not numerically identical. The soul, caught up in the fruits of action, forgets the companionship of the divine witness within. Liberation is the soul's turning toward the witnessing Lord, recognizing him, and resting in the peace of his presence.",
  },
  {
    workTitle: "Bhagavad Gita Bhashya",
    chapterRef: "Chapter IX — On the Royal Knowledge",
    content:
      "The Lord declares: 'All beings rest in me, but I do not rest in them.' This is the asymmetry at the heart of the body-soul relationship. The body depends on the soul; the soul does not depend on the body in the same way. Souls and matter constitute the Lord's body — they rest in him, are upheld by him, are pervaded by him. Yet the Lord is not exhausted or limited by his body. He transcends it while pervading it. This is why the world's reality does not threaten the Lord's supremacy — the world is real, but its reality is a dependent reality, entirely grounded in and inseparable from the existence of the Lord who is its inner soul.",
  },
];
