def convert_age_to_string(age):
    """
    This simply converts integer ages into age categories.

    :param age: age of the person
    :return: string indicating the age category of the person
    """
    if age <= 12:
        return "kid"
    if 12 < age < 20:
        return "teenager"
    if 20 <= age <= 30:
        return "young adult"
    if 30 < age <= 60:
        return "adult"
    if 60 < age <= 100:
        return "senior"
    return None