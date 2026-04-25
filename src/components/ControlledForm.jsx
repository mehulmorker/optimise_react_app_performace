import { useState } from "react";

export function ControlledForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');

  console.log('ControlledForm rendered');

  return (
    <form>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name"
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        placeholder="Bio"
      />
      <p>Name: {name}</p>
    </form>
  );
}