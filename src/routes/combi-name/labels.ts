import type {
	Action,
	CombiType,
	CookiePower,
	Episode,
	RandomBoost,
} from "./codec.ts";

// Boost names live in codec.ts because decode error messages quote them too.
export { BOOST_LABELS } from "./codec.ts";

export const TYPE_LABELS: Record<CombiType, string> = {
	score: "Score",
	money: "Money",
	exp: "Exp",
	box: "Box",
	auto: "Auto",
	semiauto: "Semi-auto",
};

export const EPISODE_LABELS: Record<Episode, string> = {
	any: "Any",
	episode1: "Episode 1",
	episode2: "Episode 2",
	episode3: "Episode 3",
	episode4: "Episode 4",
	episode5: "Episode 5",
	episode6: "Episode 6",
	episode7: "Episode 7",
	special1: "Special Episode 1",
	special2: "Special Episode 2",
	special3: "Special Episode 3",
	specialExp: "Special Exp Episode",
};

export const RANDOM_BOOST_LABELS: Record<RandomBoost, string> = {
	doubleCoins: "Double Coins",
	scoreBonus: "15% Score Bonus",
	hpDrain: "15% HP Drain",
	revive: "Revive once with 80 HP",
	crushChance: "70% Crush Chance",
	baseSpeed: "17% Base Speed",
	goldCoinMagic: "Gold Coin Magic",
	collisionDamage: "-30% Collision Damage",
	potionHp: "+20% HP from Potions",
	magneticAura: "Magnetic Aura",
	pitLifts: "2 Pit Lifts",
};

export const COOKIE_POWER_LABELS: Record<CookiePower, string> = {
	cheerleader: "Cheerleader Cookie",
	specialForce: "Special Force Cookie",
	fairy: "Fairy Cookie",
	cheesecake: "Cheesecake Cookie",
	seaFairy: "Sea Fairy Cookie",
	serenadeOfLove: "Serenade of Love",
	expParty: "EXP Party",
};

export const ACTION_LABELS: Record<Action, string> = {
	none: "No action",
	jumpAtStart: "Jump at start",
};
