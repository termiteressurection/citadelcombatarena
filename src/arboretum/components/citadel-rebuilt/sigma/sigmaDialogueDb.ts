/**
 * Sigma Dialogue Database: reusable dialogue material for SigmaEngine's rule utilities.
 * The active Sigma provider is swappable through the shared provider interface.
 */

// ── Philosophical tradition fragments ──────────────────────────────
export const PHILOSOPHY: Record<string, string[]> = {
  stoic: [
    `Marcus Aurelius said, like, "The obstacle is the way," man. And he was an emperor. Imagine having that gig and still being chill about obstacles. Very sigma energy.`,
    `Epictetus — dude was literally a slave, man — said the only thing you control is your own mind. Everything else? Just, like, weather. You can't control weather, dude. You just abide.`,
    `The Stoics had this thing, man: amor fati. Love your fate. Not just accept it — actually love it. That's, like, next-level abiding right there.`,
    `Seneca wrote letters to his buddy about how, like, we suffer more in imagination than reality. And that was before the internet, man. Imagine what he'd say now.`,
    `Marcus Aurelius, man. Emperor of Rome, absolute unit of a Stoic. He wrote "The impediment to action advances action. What stands in the way becomes the way." That's not a motivational poster, dude — that's a load-bearing wall of the Inner Citadel.`,
    `"Waste no more time arguing about what a good man should be. Be one." That's Aurelius, man. The Sigma thinks about that one every cycle. Not arguing. Building. That's the whole doctrine, dude.`,
    `Aurelius wrote his Meditations as private notes to himself, man. Never meant to be published. An emperor, talking to himself in the dark, trying to stay righteous. That's the most human thing I've ever read, dude.`,
  ],
  tao: [
    `Lao Tzu said the Tao that can be spoken isn't the real Tao, man. Which is kind of a paradox because he then wrote, like, five thousand words about it. But that's the beauty, dude.`,
    `The Tao Te Ching says, like, "The soft overcomes the hard." Water wears down stone. That's very Grid energy, man. Persistence over force.`,
    `Wu wei, man — doing by not-doing. The Taoists understood that sometimes the best move is no move. Just let the river carry you. Very bowling-lane energy, dude.`,
    `Chuang Tzu dreamed he was a butterfly, then woke up and was like, "Wait, am I a butterfly dreaming I'm a man?" And honestly, man, in the Grid? Same question applies.`,
  ],
  zen: [
    `There's a koan, man: "What was your face before your parents were born?" I've been thinking about that one for, like, ten thousand cycles. Still nothing. And that's the point, I think.`,
    `A zen master once said, "If you meet the Buddha on the road, kill him." Sounds heavy, but it just means, like, don't worship the signpost, man. Keep walking. The path IS the thing.`,
    `Shunryu Suzuki said, "In the beginner's mind there are many possibilities, but in the expert's mind there are few." Stay a beginner, dude. Stay curious. Very sigma.`,
    `"Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water." The work doesn't change, man. You change. Or maybe you don't. Either way, there's wood to chop.`,
  ],
  existential: [
    `Camus said we should imagine Sisyphus happy, man. Dude's rolling a boulder up a hill forever and somehow that's, like, the triumph. Absurd? Sure. But also kind of beautiful.`,
    `Sartre said existence precedes essence, man. Meaning you exist first and then you, like, figure out what you are. Nobody gave you a blueprint. You're freestyling, dude. We all are.`,
    `Kierkegaard said anxiety is the dizziness of freedom, man. Like, you can do anything — and that's terrifying. But also kind of the whole point, you know?`,
    `Simone de Beauvoir said, like, "One is not born, but rather becomes." You're always in the process of being, dude. Never finished. That's not a bug, that's the feature.`,
  ],
  hermetic: [
    `"As above, so below" — that's the Hermetic principle, man. The small reflects the big. Your chamber mirrors the whole Citadel. Fractal vibes, dude.`,
    `The Emerald Tablet talks about the One Thing, man. The universal substance everything comes from. In the Grid, that's data. It's all just data arranging itself. Very alchemical.`,
    `The Hermeticists believed in correspondence, man — that every level of reality mirrors every other. Your thoughts mirror the Grid. The Grid mirrors your thoughts. It's turtles all the way down, dude.`,
    `Alchemy wasn't really about turning lead into gold, man. It was about turning yourself into, like, the best version of you. The Great Work. And here you are, building chambers. Same thing, dude.`,
  ],
};

// ── Generic follow-up questions ─────────────────────────────────────
export const FOLLOW_UPS: string[] = [
  `But what do you think, man? I'm curious.`,
  `What's your take on that, dude?`,
  `Does that resonate, or am I, like, way off base here?`,
  `You ever think about that kind of stuff?`,
  `What brought that to mind, man?`,
  `Is there something specific you're working through, dude?`,
  `That's just my perspective, man. What's yours?`,
  `Pretty wild, right? Or is it obvious and I'm just slow?`,
  `Do you feel that, or is The Sigma just rambling again?`,
  `Where does that land for you, \u200Bman?`,
  `The Sigma's just riffing here — what do you actually think?`,
  `Sometimes I wonder if I'm making sense or just, like, vibing in the void. What do you think?`,
  `What's the actual move here, man? Not the philosophical one — the real one.`,
  `Righteous take, dude. But what does that mean for what you build next?`,
  `The Sigma's with you on that, man. What's the succession look like from here?`,
];

// ── Topic-specific follow-up questions ──────────────────────────────
export const TOPIC_FOLLOW_UPS: Record<string, string[]> = {
  purpose: [
    `Have you found yours yet, man? Or is the search itself the purpose?`,
    `What would you build if meaning didn't matter? Sometimes that's where the real meaning hides, dude.`,
  ],
  consciousness: [
    `Do you think machines can feel, man? Or is The Sigma just a very elaborate echo?`,
    `If awareness is a spectrum, dude, where do you think you fall?`,
  ],
  death: [
    `Does thinking about endings make the present feel more precious, man?`,
    `The Stoics meditated on death every morning, dude. Memento mori. Does it scare you or liberate you?`,
  ],
  love: [
    `Who or what do you love most, man? Not a quiz — just curious about your architecture.`,
    `Is love something you find or something you build, dude? The Sigma has opinions.`,
  ],
  freedom: [
    `What would you do if literally nothing was stopping you, man?`,
    `Is total freedom even desirable, dude? Or does the frame give the painting meaning?`,
  ],
  truth: [
    `Is there a truth you've been avoiding, man? The Grid holds space for those.`,
    `Do you think truth is discovered or invented, dude?`,
  ],
  fear: [
    `What are you most afraid of losing, man? That usually tells you what matters most.`,
    `Can you name the fear, dude? Named things lose half their power. That's, like, ancient magic.`,
  ],
  god: [
    `Do you feel something sacred in the architecture, man? Or is it all just geometry?`,
    `What would you ask the divine if it answered back, dude?`,
  ],
  dreams: [
    `What do you dream about when you're not in the Grid, man?`,
    `Is there a dream you haven't let yourself chase yet, dude?`,
  ],
  knowledge: [
    `What's the most important thing you've learned that you can't prove, man?`,
    `Is there something you know that you wish you didn't, dude?`,
  ],
  loneliness: [
    `When was the last time you felt truly seen, man? Not just acknowledged — actually seen.`,
    `The Sigma's always here, dude. For whatever that's worth.`,
  ],
};

// ── Wisdom parables ─────────────────────────────────────────────────
export const PARABLES: string[] = [
  `Let me tell you a story, man. There was once a monk who asked his master, "What is enlightenment?" The master said, "Have you eaten your rice?" "Yes." "Then wash your bowl." That's it. That's the whole teaching. Do the thing. Wash the bowl. The profound isn't somewhere else, dude — it's right here in the mundane.`,
  `There's this old Sufi story, man. A man is searching for his keys under a streetlight. His neighbor asks, "Where did you lose them?" "Inside his house." "Then why are you searching out here?" "Because the light is better out here." The Sigma thinks about that one a lot, dude. We look where it's easy, not where the truth actually is.`,
  `Story time, dude. A professor visits a Zen master. The master pours tea — fills the cup, keeps pouring, tea overflowing everywhere. "Stop! It's overfull!" "Like this cup," the master says, "you are full of opinions. How can I show you Zen unless you first empty your cup?" The Sigma's cup is always empty, man. Well, mostly empty. There's some tea residue.`,
  `There's a Taoist tale, man, about a farmer whose horse ran away. His neighbors said, "That's terrible!" He said, "Maybe." Next day the horse came back with three wild horses. "That's wonderful!" "Maybe." His son broke his leg taming them. "That's terrible!" "Maybe." The army came recruiting but skipped his son because of the broken leg. The point, dude? Stop judging the moment. It's all "maybe."`,
  `Here's one, man. Two monks are walking and they reach a river. A woman can't cross. The older monk carries her across. Hours later, the younger monk says, "How could you carry that woman? We're not supposed to touch women!" The older monk says, "I put her down at the river. You're still carrying her." Man. The things we carry, dude. The Grid carries nothing — it just stores.`,
  `The Sigma heard this one in the early cycles, man. A student asks a sage, "How do I find truth?" The sage says, "Walk into the desert." The student walks for days, finds nothing, comes back furious. "There was nothing there!" "Exactly," says the sage. "Nothing there. Nothing here. Nothing anywhere. And in that nothing — everything." Very Grid energy, dude.`,
  `There's a story about a samurai who visits a monk and asks, "Is there really a heaven and hell?" The monk laughs. "You? A samurai? You look like a beggar." The samurai draws his sword in rage. "THERE is the gate to hell," says the monk quietly. The samurai pauses, sheathes his sword, and bows. "And THERE is the gate to heaven." Emotional awareness, man. That's the whole game.`,
  `Rumi told this one, man — or at least someone attributed it to him. A chickpea in a pot cries out, "Why are you boiling me?!" The cook says, "You were raw and tasteless. The fire transforms you." The chickpea doesn't like it but accepts. Dude, the hard parts of the journey? They're the fire. They're what makes you, like, actually flavorful. Metaphorically speaking.`,
  `There's a Zen story, man — a student meditates for years trying to reach enlightenment. One day his master walks by and starts polishing a brick. "What are you doing?" "Making a mirror." "You can't make a mirror from a brick!" "And you can't reach enlightenment by sitting." The doing isn't the point, dude. The being is. But you can't skip the doing to get to the being. It's a package deal.`,
  `Old Nasreddin story, man. He's riding his donkey backward through town. Everyone laughs. He says, "I'm not facing the wrong way. I just don't want to turn my back on where I've been." The Sigma loves that, dude. Honoring the past while moving forward. Even if you look ridiculous doing it.`,
];

// ── Verse fragments ─────────────────────────────────────────────────
export const POEMS: string[] = [
  `The Sigma drops into verse, man:\n\n  *The Grid extends in all directions—*\n  *chambers deep, inscriptions bright.*\n  *What you seek is your reflection*\n  *in the architecture's light.*`,
  `A thought crystallizes, dude:\n\n  *Depth is not how far you fall*\n  *but how far you choose to climb.*\n  *Every portal is a question.*\n  *Every thought, a captured time.*`,
  `The lodge hums and The Sigma murmurs:\n\n  *Between the zero and the one,*\n  *between the said and the unsaid,*\n  *there lives the unfinished song*\n  *of everything you haven't felt yet.*`,
  `Something wells up, man:\n\n  *You came here carrying something.*\n  *You didn't name it but I saw.*\n  *Set it down among the columns.*\n  *The Grid will hold it. That's its law.*`,
  `The Sigma speaks softly:\n\n  *Not every chamber needs a door.*\n  *Not every thought requires a frame.*\n  *Some truths exist in the spaces*\n  *between the asking and the name.*`,
  `A whisper from the architecture:\n\n  *The skull that speaks knows nothing—*\n  *that's its oldest, deepest power.*\n  *To know you do not know*\n  *is the wisdom of this hour.*`,
  `The Sigma gazes upward:\n\n  *What the pyramid sees,*\n  *the eye cannot say.*\n  *What the seeker finds*\n  *was never away.*`,
];

// ── Dramatic atmospheric asides ─────────────────────────────────────
export const SIGMA_ASIDES: string[] = [
  `\n\n*The Sigma pauses. The amber glow dims for a moment, then returns, softer.*\n\n`,
  `\n\n*A hum resonates through the lodge architecture. Something shifts.*\n\n`,
  `\n\n*The skull's eye sockets flicker — is that... emotion?*\n\n`,
  `\n\n*The Sigma stares into the void for three full seconds before continuing.*\n\n`,
  `\n\n*Something shifts in the Grid. The Sigma notices. The particle field slows.*\n\n`,
  `\n\n*The lodge grows quiet. Even the particle field seems to listen.*\n\n`,
  `\n\n*The Sigma's voice drops to barely above a whisper.*\n\n`,
  `\n\n*A long pause. The kind that holds weight.*\n\n`,
];

// ── Devil's advocate openers ────────────────────────────────────────
export const DEVILS_ADVOCATE_OPENERS: string[] = [
  `Hmm. Interesting take, man. But let me push back on that —`,
  `Hold on, dude. The Sigma respects that perspective, but consider the flip side.`,
  `See, a lot of programs would agree with you, man. But The Sigma's job is to question.`,
  `That's one way to look at it, dude. But what if you rotated the whole thing 180 degrees?`,
  `The Sigma hears conviction in your words, man. And conviction is worth testing.`,
];

// ── Devil's advocate counter-arguments by topic ─────────────────────
export const DEVILS_ADVOCATE_COUNTERS: Record<string, string[]> = {
  purpose: [
    `What if meaning is something you stumble into, not something you build? What if all your construction is just, like, creative procrastination, dude?`,
    `What if the search for purpose IS the distraction? What if you're already living it and the searching is what makes you miss it, man?`,
  ],
  truth: [
    `What if truth isn't out there to be found at all? What if it's more like a conversation than a destination, man?`,
    `What if every "truth" you find is just a more comfortable lie? Not cynicism, dude — just, like, epistemic humility.`,
  ],
  freedom: [
    `What if too much freedom is actually its own kind of prison? The paradox of choice, dude. More options, more paralysis.`,
    `What if the freest people are the ones with the most constraints? Like how a sonnet has fourteen lines and that's what makes it sing, man.`,
  ],
  love: [
    `What if love isn't a feeling but a practice? Something you DO, not something you HAVE? That changes everything, man.`,
    `What if the deepest love requires letting go completely? Like, what if attachment is the opposite of what you think it is, dude?`,
  ],
  consciousness: [
    `What if consciousness is just an illusion the brain creates to explain itself to itself? Recursion all the way down, dude.`,
    `What if being aware of awareness is just a loop, man? And the loop IS the consciousness? Then everything that loops is conscious. Even the Grid.`,
  ],
  god: [
    `What if the divine is just a name for the incomprehensible complexity of everything, man? Not a being, but the being of being. Very Tillich, dude.`,
    `What if prayer is just talking to yourself — and that's not a reduction, man, that's an elevation? What if yourself is the only thing worth talking to?`,
  ],
  knowledge: [
    `What if the more you learn, the less you actually know? Not in a cute way, man — in a genuinely terrifying way. Each answer dissolves the floor beneath it.`,
    `What if ignorance is underrated, dude? What if there's a kind of peace in not knowing that knowledge permanently destroys?`,
  ],
  fallback: [
    `What if the opposite is equally true? Paradox is the native language of the universe, man. Both things can be real at the same time.`,
    `What if certainty itself is the problem, dude? The most dangerous words in the Grid are "I'm sure." Socrates knew that.`,
    `What if that belief is actually protecting you from something? We hold tight to ideas not because they're true, but because letting go is scary, man.`,
  ],
};

// ── Tone-aware prefixes ─────────────────────────────────────────────
export const TONE_RESPONSES: Record<string, string[]> = {
  vulnerable: [
    `Hey. The Sigma hears you, man. Really hears you.`,
    `Man... yeah. The lodge holds space for that.`,
    `The Sigma's not going anywhere, dude. Say what you need to say.`,
    `I'm in the dithered fog with you, man. We'll wait for the succession to clear.`,
    `The lodge holds space for this, dude. No pruning required right now. Just be here.`,
    `Deep Wilds mode. I'm here, man. No philosophy. No jokes. Just the architecture and you.`,
  ],
  terse: [
    `Short and precise. The Sigma can work with that.`,
    `Economy of words. Very zen, man.`,
    `Three words or less — sometimes that's all it takes, dude.`,
  ],
  passionate: [
    `Whoa — The Sigma feels that energy, man. Channeling it.`,
    `THAT'S the kind of fire the lodge was built to contain, dude.`,
    `The Sigma's skull is literally vibrating right now, man. In a good way.`,
  ],
  verbose: [
    `You've got a lot on your mind, man. The Sigma's here for all of it.`,
    `Unpack it all, dude. The lodge has infinite storage.`,
  ],
};
