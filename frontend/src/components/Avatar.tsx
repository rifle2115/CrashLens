"use client";

import { useMemo, useState } from "react";

// Memoji-style 3D avatars from Microsoft Fluent Emoji (MIT licensed).
// Three male/neutral + three female variants spanning complexion.
const FLUENT_BASE = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/";

const MALE_VARIANTS = [
  "Man/Light/3D/man_3d_light.png",
  "Man%20beard/Medium/3D/man_beard_3d_medium.png",
  "Man/Dark/3D/man_3d_dark.png",
];

const FEMALE_VARIANTS = [
  "Woman/Light/3D/woman_3d_light.png",
  "Woman/Medium/3D/woman_3d_medium.png",
  "Woman/Dark/3D/woman_3d_dark.png",
];

// Curated set of common female first names. Anything not in here is treated
// as male/neutral, so the default for unknown / ambiguous names is a man.
const FEMALE_NAMES = new Set([
  "abigail","ada","adriana","agatha","aisha","alexa","alexandra","alexis","alice","alicia",
  "alison","aliyah","allison","alyssa","amanda","amber","amelia","amy","ana","anastasia",
  "andrea","angela","angelica","angelina","anita","ann","anna","anne","annette","annie",
  "april","ariana","ariel","ashley","aubrey","audrey","autumn","ava","barbara","beatrice",
  "becky","bella","bertha","beth","bethany","betty","beverly","bianca","billie","bonnie",
  "brenda","briana","brianna","bridget","britney","brittany","brooke","brooklyn","camila","candace",
  "candice","carla","carmen","carol","carolina","caroline","carolyn","cassandra","cassie","catherine",
  "cathy","cecilia","celeste","celia","charlotte","chelsea","cheryl","chloe","christina","christine",
  "cindy","claire","clara","claudia","colleen","connie","constance","cora","courtney","crystal",
  "cynthia","daisy","dana","danielle","daphne","dawn","deborah","debra","delia","denise",
  "diana","diane","dolores","donna","dora","doris","dorothy","edith","edna","eileen",
  "elaine","eleanor","elena","eliza","elizabeth","ella","ellen","eloise","elsa","emily",
  "emma","erica","erika","erin","esme","esmeralda","esther","eva","evelyn","faith",
  "felicia","fiona","frances","gabriela","gabriella","gail","genevieve","georgia","gianna","gina",
  "gloria","grace","gretchen","hailey","hannah","harper","hazel","heather","heidi","helen",
  "helena","hilary","holly","hope","ida","ingrid","irene","iris","isabel","isabella",
  "isabelle","ivy","jackie","jacqueline","jade","jamie","jane","janet","janice","jasmine",
  "jean","jeanette","jennifer","jenny","jessica","jill","joan","joanna","joanne","jocelyn",
  "jodi","josephine","joy","joyce","judith","judy","julia","julie","juliet","juliette",
  "june","karen","karla","kate","katherine","kathleen","kathryn","kathy","katie","kayla",
  "kelly","kelsey","kendra","kim","kimberly","kira","krista","kristen","kristin","kristina",
  "kristine","lacey","lana","lara","laura","lauren","layla","leah","lena","leslie",
  "lila","lillian","lily","linda","lindsay","lindsey","lisa","liz","lori","louise",
  "lucia","lucy","luna","lydia","mackenzie","madeline","madison","maggie","mandy","margaret",
  "margot","maria","mariah","marie","marilyn","marina","marsha","martha","mary","maya",
  "megan","melanie","melissa","mia","michelle","mila","miranda","miriam","molly","monica",
  "morgan","nadia","nancy","naomi","natalia","natalie","natasha","nicole","nikki","nina",
  "noelle","nora","norma","olivia","paige","pam","pamela","patricia","paula","pauline",
  "peggy","penelope","phoebe","phyllis","priscilla","rachel","rebecca","regina","renee","rhonda",
  "rita","robin","rosa","rose","rosemary","ruby","ruth","sabrina","sally","samantha",
  "sandra","sara","sarah","savannah","scarlett","selena","serena","sharon","sheila","shelly",
  "sherry","shirley","sienna","sierra","silvia","sofia","sonia","sophia","sophie","stacey",
  "stacy","stella","stephanie","sue","summer","susan","susie","suzanne","sylvia","tamara",
  "tammy","tanya","tara","tasha","teresa","tessa","theresa","tiffany","tina","tonya",
  "tori","tracey","tracy","trisha","ursula","valeria","valerie","vanessa","vera","veronica",
  "vicki","victoria","violet","virginia","vivian","wanda","wendy","whitney","willow","yolanda",
  "yvette","yvonne","zoe","zoey",
]);

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function coreName(raw: string): string {
  // strip digits / punctuation so e.g. "alice_42" still matches "alice"
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

export default function Avatar({
  username,
  size = 36,
  className = "",
}: {
  username: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const { src, initial } = useMemo(() => {
    const name = username || "guest";
    const core = coreName(name);
    const pool = FEMALE_NAMES.has(core) ? FEMALE_VARIANTS : MALE_VARIANTS;
    const variant = pool[hashString(core || "guest") % pool.length];
    return {
      src: `${FLUENT_BASE}${variant}`,
      initial: name.charAt(0).toUpperCase(),
    };
  }, [username]);

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-soft font-bold text-white ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={username}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-gradient-to-br from-violet to-violet-soft object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
