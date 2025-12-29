/**
 * Sports Constants
 * Centralized sports data for the application
 */

export const sportsData = {
  team: [
    { name: 'Cricket', image: '/images/Cricket.jpg', text: 'College teams clash for the trophy.', players: 15 },
    { name: 'Volleyball', image: '/images/Vollyball.jpg', text: 'Smash, block and dominate the court.', players: 9 },
    { name: 'Badminton', image: '/images/Badminton.jpeg', text: "Men's & women's doubles and team events.", players: 4 },
    { name: 'Table Tennis', image: '/images/Tabletennis.jpeg', text: 'Fast rallies and sharp reflexes.', players: 4 },
    { name: 'Kabaddi', image: '/images/Kabbadi.png', text: 'Raid, tackle and roar with your squad.', players: 10 },
    { name: 'Relay 4×100 m', image: '/images/Relay1.o.jpg', text: 'High-speed baton relay on the track.', players: 4 },
    { name: 'Relay 4×400 m', image: '/images/Relay.jpg', text: 'Ultimate test of stamina and teamwork.', players: 4 },
  ],
  individual: [
    { name: 'Carrom', image: '/images/Carrom.jpg', text: 'Strike and pocket with precision.' },
    { name: 'Chess', image: '/images/Chess.jpeg', text: 'Outplay your opponent on the board.' },
    { name: 'Sprint 100 m', image: '/images/Sprint1.jpg', text: 'Pure explosive speed on track.' },
    { name: 'Sprint 200 m', image: '/images/Sprint2.jpg', text: 'Power and pace around the bend.' },
    { name: 'Sprint 400 m', image: '/images/Sprint3.jpg', text: 'One full lap of endurance sprint.' },
    { name: 'Long Jump', image: '/images/Longjump.jpeg', text: 'Fly the farthest into the sand pit.' },
    { name: 'High Jump', image: '/images/Highjump.jpeg', text: 'Clear the bar and set new heights.' },
    { name: 'Javelin', image: '/images/javelin.jpeg', text: 'Throw for maximum distance.' },
    { name: 'Shot Put', image: '/images/Shotput.jpeg', text: 'Show your strength in the circle.' },
    { name: 'Discus Throw', image: '/images/Discussthrow.jpeg', text: 'Perfect spin and powerful release.' },
  ],
  cultural: [
    { name: 'Essay Writing', image: '/images/Essay Writing.jpg', text: 'Express your thoughts powerfully.' },
    { name: 'Story Writing', image: '/images/Story Writing.jpg', text: 'Craft compelling narratives.' },
    { name: 'Group Discussion', image: '/images/gd.png', text: 'Showcase leadership & ideas.' },
    { name: 'Debate', image: '/images/Debate.jpg', text: 'Argue, persuade, win.' },
    { name: 'Extempore', image: '/images/Extempore.jpeg', text: 'Think fast, speak boldly.' },
    { name: 'Quiz', image: '/images/Quiz.jpg', text: 'Test your knowledge.' },
    { name: 'Dumb Charades', image: '/images/Dumb_Charades.jpg', text: 'Act it out, guess it right.' },
    { name: 'Painting', image: '/images/painting.png', text: 'Unleash your creativity.' },
    { name: 'Singing', image: '/images/Singing.jpg', text: 'Voice your passion.' },
  ],
}

// Sport type helpers
export const getSportType = (sportName) => {
  if (sportsData.team.some(s => s.name === sportName)) return 'team'
  if (sportsData.cultural.some(s => s.name === sportName)) return 'cultural'
  return 'individual'
}

export const isTeamSport = (sportName) => {
  return sportsData.team.some(s => s.name === sportName)
}

export const isCulturalSport = (sportName) => {
  return sportsData.cultural.some(s => s.name === sportName)
}

