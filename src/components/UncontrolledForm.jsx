import { useRef } from "react";

export function UncontrolledForm() {
  const nameRef = useRef();
  const emailRef = useRef();
  const bioRef = useRef();

  console.log('UncontrolledForm rendered');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({
      name: nameRef.current.value,
      email: emailRef.current.value,
      bio: bioRef.current.value,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={nameRef} defaultValue="Mehul" placeholder="Name" />
      <input ref={emailRef} defaultValue="" placeholder="Email" />
      <textarea ref={bioRef} defaultValue="" placeholder="Bio" />
      <button type="submit">Submit</button>
    </form>
  );
}